# ETL Overview

This document outlines the deployment and architecture of the end-to-end data pipeline and integrated analytics suite for the Butchery POS system. The entire ecosystem is hosted on Google Cloud Platform (GCP) using a modern, serverless stack.

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
3. **Data Sync:** The ETL service extracts the latest records from Postgres, cleans the data using Pandas, and loads it into BigQuery.
4. **Analytical Query:** The frontend requests specific report data from the FastAPI backend (e.g., `/api/reports/kpis`).
5. **BQ Execution:** The backend runs specialized SQL against the warehouse and returns the results as JSON.
6. **Visualization:** Data is rendered instantly in the app using Recharts, providing real-time visibility into net profit, wastage, and marketing ROI.

---

## Key Infrastructure Benefits

- **Zero-Latency Perception:** By triggering the ETL on-demand, the "Data Lag" typical in enterprise warehouses is eliminated for the end-user.
- **Serverless Scaling:** Every component is serverless, meaning you pay only for the compute time used during the sync and the data BigQuery scans.
- **Unified UI:** Staff and management access high-level reporting within the same interface used for sales, creating a centralized "Command Center" for the business.