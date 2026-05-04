# ETL Overview

This document outlines the deployment and architecture of the end-to-end data pipeline and integrated analytics suite for the Butchery POS system. The entire ecosystem is hosted on Google Cloud Platform (GCP) using a modern, serverless stack.

**Sections [6](#6-transform-layer-exact-steps-in-etl_pipelinepy) and [7](#7-from-transformed-warehouse-columns-to-reports-metrics)** spell out every **transform** in the reference `etl_pipeline.py`, alignment with `Data_warehouse_schema.sql`, and how those columns become the **Reports** metrics.

---

## 1. The Operational Database (OLTP)

- **Service:** Google Cloud SQL
- **Engine:** PostgreSQL 15
- **Instance ID:** `butchery-ops-db`
- **Description:** This is the "Source of Truth" for live operations. It handles high-frequency writes from the POS terminal, including sales transactions, real-time inventory adjustments, and wastage logging.

---

## 2. The Analytical Data Warehouse (OLAP)

- **Service:** Google BigQuery
- **Architecture:** Multi-Fact Star Schema
- **Description:** BigQuery serves as the high-performance analytical core.
  - **Data Structure:** Organized into 8 tables (5 Dimensions, 3 Fact tables) to allow for complex "Drill-Down" analysis.
  - **Optimization:** Fact tables use Date Partitioning, ensuring that as the franchise grows, the reporting engine remains fast and cost-efficient.
  - **Type Stability:** All metrics are stored as `FLOAT64` to match Python's numerical precision during the ETL process.

---

## 3. The ETL Pipeline (Serverless Orchestrator)

- **Service:** Google Cloud Run
- **Runtime:** Python 3.11 (utilizing Pandas and SQLAlchemy)
- **Deployment:** Triggered via HTTP POST at `/api/etl/sync`.
- **Description:** This service handles the synchronization between the Operational Database (OLTP) and the Warehouse (OLAP).
  - **On-Demand Sync:** The application is designed to trigger this pipeline automatically whenever the Reporting Dashboard is accessed, ensuring users always see the latest data.
  - **Full Synchronization:** The pipeline executes a robust transfer of transactional data from Cloud SQL to BigQuery, transforming relational records into the analytical star schema format.

### 3.1 Reference-only code in this repository

The Python entrypoint **`etl_pipeline.py`** and **`Data_warehouse_schema.sql`** in this folder are **documentation and marking references**. They describe the **intended** warehouse shape and transform logic; the **live** ETL job runs on **Google Cloud Run**. The POS app does not execute this local file—it calls the deployed HTTP endpoint to sync.

---

## 4. Integrated Reporting Engine (Embedded Analytics)

- **Architecture:** Integrated BI (Business Intelligence)

### Backend Stack

- **FastAPI:** Serves as the primary API layer for the reporting dashboard.
- **Google Cloud BigQuery SDK:** The `google-cloud-bigquery` library is used to execute high-speed, parameterized SQL queries.
- **Security & Optimization:** Queries utilize `bigquery.QueryJobConfig` and `ScalarQueryParameter` to prevent SQL injection and ensure type-safe execution. The BigQuery client is managed via `functools.lru_cache` for efficient resource handling.

### Frontend Stack

- **React:** Powers the interactive user interface.
- **Recharts:** A composable charting library used to render `LineCharts` (Revenue Trends), `BarCharts` (Sales Velocity/Product Performance), and `PieCharts` (Category Mix).
- **Tailwind CSS:** Provides the utility-first styling for the dashboard's responsive "Card-based" layout.
- **`Intl.NumberFormat`:** Used for localizing currency (AUD) and quantity formatting across all KPI tiles and tables.

---

## 5. End-to-End Data Flow

1. **Transactional Write:** POS sales and wastage events are recorded in Cloud SQL.
2. **Dashboard Access:** Navigating to the Reports page in the React frontend triggers a POST request to the Cloud Run ETL service.
3. **Data Sync:** The ETL service re-reads Postgres, applies transforms in Pandas, and reloads the BigQuery tables so each sync reflects the **current** OLTP snapshot.
4. **Analytical Query:** The frontend requests specific report data from the FastAPI backend (e.g., `/api/reports/kpis`).
5. **BQ Execution:** The backend runs specialized SQL against the warehouse and returns the results as JSON.
6. **Visualization:** Data is rendered instantly in the app using Recharts, providing real-time visibility into net profit, wastage, and marketing ROI.

---

## 6. Transform layer (exact steps in etl_pipeline.py)

Below, **Extract** is what is read from Postgres (SQL strings or `SELECT *`). **Transform** is every change applied in Python (pandas) before load. **Load** is how the dataframe is written to BigQuery. Column names below match **`Data_warehouse_schema.sql`** unless noted.

### 6.1 Dimensions

| BigQuery table | Extract | Transform (pandas) | Load |
| --- | --- | --- | --- |
| **`dim_products`** | `sql_prod`: join `products` → `product_categories` → `suppliers`; aliases `product_id`, `product_name`, `category`, `supplier`, `current_retail_price`, `current_cost_price`, `unit_measure`. | **`unit_measure`:** `fillna` with empty string, then `astype(str)` (lines 42–43). **`product_name`:** cast to string, **title case** via `.str.title()` (43). **`category`:** cast to string, **uppercase** via `.str.upper()` (44). **`current_retail_price`**, **`current_cost_price`:** cast to **`float`** (45). | Load replaces the BigQuery table from the dataframe (line 46). |
| **`dim_promotions`** | `promotions` with `id` → `promo_id`, plus `promo_name`, `discount_percent`, `is_active`. | **`discount_percent`:** `astype(float)` (49). | Load replaces the BigQuery table from the dataframe (line 50). |
| **`dim_shops`** | `SELECT * FROM shops`. | **None** in script—dataframe as returned by the driver. | Load replaces the BigQuery table from the dataframe (line 52). |
| **`dim_staff`** | `SELECT * FROM shop_staff` (loaded into table **`dim_staff`** in BQ). | **None** in script. | Load replaces the BigQuery table from the dataframe (line 53). |
| **`dim_customers`** | `SELECT * FROM customers`. | **None** in script. | Load replaces the BigQuery table from the dataframe (line 54). |

### 6.2 Fact 1 — `fact_sales_performance`

**Extract** (`sql_sales`, lines 60–68): one row per **sale line** (`sale_items` ⋈ `sales`, `LEFT JOIN products`). Brings `sale_id`, `shop_id`, `staff_id`, `product_id`, `quantity`, `price_at_sale`, `discount_applied`, **`cost_price`** = `COALESCE(products.cost_price, 0)` (missing product cost treated as **0** in the extract SQL), and `sale_timestamp` from `sales.created_at`.

**Transform** (lines 71–80, only if the dataframe is non-empty):

| New / updated column | Definition |
| --- | --- |
| `gross_revenue` | `quantity * price_at_sale`, then `astype(float)` (72). |
| `net_revenue` | `gross_revenue - discount_applied`, then `astype(float)` (73). |
| `total_cogs` | `quantity * cost_price`, then `astype(float)` (74). |
| `net_profit` | `net_revenue - total_cogs`, then `astype(float)` (75). |
| `tax_amount` | **`net_revenue * 0.1`**, rounded to **two** decimal places (`.round(2)`), then `astype(float)` (76). *This is a fixed 10% model on net revenue at line level.* |
| `sale_timestamp` | `pd.to_datetime(...)` (77). |
| `hour_of_day` | Integer hour `0–23` from `sale_timestamp.dt.hour` (78). |
| `day_name` | String weekday name from `sale_timestamp.dt.day_name()` (e.g. `Monday`) (79). |
| `quantity`, `price_at_sale`, `discount_applied`, `cost_price` | Normalised to **`float`** (80). |

**Load:** the script clears the BigQuery fact table for this run, then loads the new rows (lines 58, 81).

These columns are the ones declared in **`Data_warehouse_schema.sql`** for `fact_sales_performance` (including `gross_revenue` … `day_name`).

### 6.3 Fact 2 — `fact_wastage_loss`

**Extract** (`sql_waste`, lines 89–96): one row per wastage event; `cost_price` = `COALESCE(products.cost_price, 0)` in SQL.

**Transform** (lines 99–104, if non-empty):

| New / updated column | Definition |
| --- | --- |
| `total_loss_value` | `quantity_wasted * cost_price`, `astype(float)` (100). |
| `event_timestamp` | `pd.to_datetime(...)` (101). |
| `reason` | Cast to string, **uppercase** with `.str.upper()` (102). |
| `quantity_wasted`, `cost_price` | `astype(float)` (103–104). |

**Load:** same clear-then-load pattern (lines 87, 105). Schema: **`Data_warehouse_schema.sql`** `fact_wastage_loss`.

### 6.4 Fact 3 — `fact_marketing_impact`

**Extract** (`sql_mkt`, lines 113–120): only sale lines where **`sales.promo_id IS NOT NULL`**. SQL already exposes:

- `discount_value_given` = `sale_items.discount_applied`
- `gross_revenue_pre_discount` = `quantity * price_at_sale`

**Transform** (lines 124–126, if non-empty): `sale_timestamp` → `pd.to_datetime`; `quantity`, `discount_value_given`, `gross_revenue_pre_discount` → **`float`**. No further arithmetic in Python for this fact.

**Load:** same clear-then-load pattern (lines 111, 127). Schema: **`Data_warehouse_schema.sql`** `fact_marketing_impact`.

---

## 7. From transformed warehouse columns to Reports metrics

Reporting does **not** recompute line-level `gross_revenue`, `net_profit`, etc. in the app; it **aggregates** the BigQuery tables (see **`backend/routers/reports.py`**) and the React **Reports** page binds to the JSON. The chain is: **ETL transform column → fact/dim row in BQ (per `Data_warehouse_schema.sql`) → SQL `SUM` / `COUNT` / `SAFE_DIVIDE` in reports API → KPI/chart/table on Reports**.

### 7.1 Line-level facts → what the API sums

| Transformed column (source) | Typical aggregation on Reports | Appears on Reports as |
| --- | --- | --- |
| `fact_sales_performance.gross_revenue` | `SUM` in KPIs; per-day `SUM` in `/reports/revenue-trend` | KPI **Gross revenue** only. The **trend** line chart plots **net revenue**, **net profit**, and **transactions**—it does not draw `gross_revenue` even though the API returns it. |
| `fact_sales_performance.net_revenue` | `SUM`; also `SAFE_DIVIDE(SUM(net_revenue), COUNT(DISTINCT sale_id))` for basket | KPI **Net revenue**; trend **Net revenue**; velocity charts (net); top products; category mix; staff **Net revenue**. |
| `fact_sales_performance.net_profit` | `SUM` | KPI **Net profit**; trend; top products; staff. |
| `fact_sales_performance.total_cogs` | `SUM` | KPI **COGS**. |
| `fact_sales_performance.tax_amount` | `SUM` as `total_tax` | KPI **Tax paid**. |
| Distinct `sale_id` on sales fact | `COUNT(DISTINCT sale_id)` | KPI **Transactions**; trend **Transactions**; staff **Transactions**; promo **Redemptions**. |
| `fact_sales_performance.hour_of_day`, `day_name` | Grouped in `/sales-velocity`; UI may sum across days or hours | **Sales velocity** bar charts (after client-side rollup). |
| `fact_wastage_loss.total_loss_value` | `SUM` | KPI **Total loss (wastage)**; wastage by reason / by product. |
| Wastage rows | `COUNT(*)` | KPI **Wastage events**; wastage breakdown **events**. |
| `fact_wastage_loss.reason` (uppercased in ETL) | `GROUP BY` in wastage summary | Wastage **by reason** labels. |
| `dim_products` (post-transform name, category, unit) | `JOIN` on facts | Product / category labels; **unit_measure** in tables (API may coalesce empty to `—`). |
| `fact_marketing_impact.gross_revenue_pre_discount`, `discount_value_given` | `SUM` each; net promo line revenue as `SUM(gross - discount)`; `SAFE_DIVIDE(SUM(discount), SUM(gross))` as **discount share** | **Promotional ROI** table (gross pre-discount, discount given, net revenue, **Margin bleed** / discount share). |
| `dim_promotions` | `JOIN` on `promo_id` | Promo name, **discount_percent** in ROI table. |
| `dim_staff` | `JOIN` on staff | Staff name, role in **Staff performance**. |

### 7.2 Where to read the exact SQL

- **Warehouse shape:** `ETL Pipeline/Data_warehouse_schema.sql` (dataset **`Our_data_warehouse`** in the reference DDL).
- **Aggregations:** `backend/routers/reports.py` (routes under `/reports/`).
- **UI wiring:** `frontend/src/pages/Reports.jsx`.

---

## 8. Key Infrastructure Benefits

- **Zero-Latency Perception:** By triggering the ETL on-demand, the "Data Lag" typical in enterprise warehouses is eliminated for the end-user.
- **Serverless Scaling:** Every component is serverless, meaning you pay only for the compute time used during the sync and the data BigQuery scans.
- **Unified UI:** Staff and management access high-level reporting within the same interface used for sales, creating a centralized "Command Center" for the business.