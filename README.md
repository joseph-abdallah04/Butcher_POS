# Butchery POS — Technical Documentation & Assignment 2 Report Companion

This repository is a **franchise-aware point-of-sale and reporting system** for a butchery chain: operational data lives in **Google Cloud SQL (PostgreSQL)**; analytics run in **Google BigQuery** after an **ETL job on Cloud Run** loads or refreshes warehouse tables. The **Butchery POS** web app (React + FastAPI) records sales, wastage, inventory movements, and master data, triggers ETL from the Reports screen, and renders dashboards from BigQuery.

Use **Part A** for setup and deployment. Use **Part B** when writing **41091 Data Systems — Assignment 2** so diagrams, narratives, and tests align with the marking criteria and match what this codebase actually does.

---

## Table of contents

1. [Part A — Project overview & developer setup](#part-a--project-overview--developer-setup)
2. [Part B — Assignment 2 report companion](#part-b--assignment-2-report-companion)
3. [Operational database (OLTP) schema summary](#operational-database-oltp-schema-summary)
4. [ETL pipeline (Cloud Run) — behaviour](#etl-pipeline-cloud-run--behaviour)
5. [Data warehouse (BigQuery) schema summary](#data-warehouse-bigquery-schema-summary)
6. [Application backend & frontend map](#application-backend--frontend-map)
7. [Marking sheet alignment (quick reference)](#marking-sheet-alignment-quick-reference)

---

## Part A — Project overview & developer setup

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend API | FastAPI, Pydantic v2, SQLAlchemy, `cloud-sql-python-connector[pg8000]` |
| Analytics queries | `google-cloud-bigquery` |
| OLTP | Cloud SQL for PostgreSQL |
| Warehouse | BigQuery dataset (e.g. `Our_data_warehouse`) |
| ETL | Separate Cloud Run service: Python, `pandas`, SQLAlchemy + Connector, BigQuery client (`functions_framework.http` entrypoint) |
| Deployment | Single Cloud Run service (Dockerfile): serves `/api/*` and static SPA from `frontend/dist` |

### Repository layout

```
Butcher_POS/
  Dockerfile                 # Multi-stage: npm build → Python image + SPA static files
  backend/
    main.py                  # FastAPI app, CORS, routers under /api, StaticFiles for SPA
    database.py              # Cloud SQL Connector + SQLAlchemy engine + SessionLocal
    models.py                # ORM aligned with OLTP tables (shops, products, sales, …)
    schemas.py               # Request/response validation (enums for payment, wastage reason)
    inventory_stock.py       # Stock deltas, non-negative enforcement, InsufficientStock
    bigquery_client.py       # Lazy BigQuery client for Reports router
    routers/                 # shops, staff, categories, suppliers, customers, promotions,
                             # products, inventory, sales, wastage, etl, reports
    requirements.txt
    .env.example             # Template only — copy to .env locally (never commit .env)
  frontend/
    src/
      App.jsx, api.js, demo.js
      context/SessionContext.jsx    # Shop + staff lock (pseudo-session)
      pages/POS.jsx, Wastage.jsx, Reports.jsx, admin/*
      utils/stock.js               # Client-side stock helpers for UX
```

### Quick preview (no cloud)

```bash
cd frontend && npm install && npm run demo
```

Opens the UI with **in-memory mock data** (`VITE_DEMO=true`). Nothing persists; use for UI screenshots only.

### Local development (real stack)

**Terminal 1 — backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # Fill with real values (never commit)

gcloud auth application-default login   # Cloud SQL Connector + BigQuery from laptop

cd ..
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend && npm install && npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Open `http://localhost:5173`, pick **shop + staff** on the lock screen.

### Environment variables

See `backend/.env.example`. Typical variables:

| Variable | Purpose |
| --- | --- |
| `INSTANCE_CONNECTION_NAME` | `project:region:instance` for Cloud SQL |
| `DB_USER`, `DB_PASS`, `DB_NAME` | PostgreSQL credentials |
| `PRIVATE_IP` | Non-empty → use instance private IP |
| `BQ_PROJECT_ID`, `BQ_DATASET` | BigQuery project and dataset for Reports |
| `EXTRA_CORS_ORIGINS` | Optional comma-separated origins for dev |

The POS service triggers ETL via `POST /api/etl/sync` (see `backend/routers/etl.py`), which performs an **HTTP GET** to your separate Cloud Run ETL URL (`ETL_URL` in `backend/routers/etl.py`). Ensure that URL and IAM (`run.invoker` on the ETL service when ingress is restricted) match your deployment.

### Deploy POS to Cloud Run (monolith)

From repo root (adjust names):

```bash
PROJECT=your-gcp-project
REGION=australia-southeast1
INSTANCE=$PROJECT:$REGION:your-cloud-sql-instance

gcloud run deploy butchery-pos \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE \
  --set-env-vars "DB_USER=...,DB_PASS=...,DB_NAME=...,INSTANCE_CONNECTION_NAME=$INSTANCE,BQ_PROJECT_ID=$PROJECT,BQ_DATASET=Our_data_warehouse"
```

Grant the service account **Cloud SQL Client** and BigQuery **Data Viewer** + **Job User** (see `.env.example` / prior docs).

### Important product behaviours (factually correct for reports)

- **Shop + staff lock**: Not password login; users select **shop** and **staff** once; values are stored in React context / `localStorage` and sent on writes (`shop_id`, `staff_id`).
- **Sales**: Single DB transaction — insert `sales`, then `sale_items`, then **reduce inventory** per line; **`stock_level` cannot go negative** (server rejects oversell).
- **Wastage**: Same inventory rule; **`staff_id`** is stored on each wastage row in the running application (your coursework DDL snippet may omit `staff_id`; production schema used by the app and ETL includes it — reconcile diagrams with your live database).
- **Inventory**: `GET /api/inventory`, `POST /api/inventory/restock`; first sale/wastage can create an inventory row; restocks bump stock and set `last_restock_date`.
- **Reports**: On load, frontend calls **`POST /api/etl/sync`**, waits for success, then queries **`/api/reports/*`** with optional **`shop_id`** (current shop, all shops, or chosen shop).

---

## Part B — Assignment 2 report companion

The official template expects: **Introduction → System Architecture (ETL + reporting app) → ETL task flows → Application task flows → Interface design → Hardware/software → System testing** (procedure, cases, results, incidents). The **high-performing example** (POSsible) uses **class/deployment diagrams**, **swimlanes**, **navigation diagram**, **annotated UI screenshots**, and **test tables** mapped to **functional requirement IDs**. Your group should **reuse that structure** but replace every technical claim with **Butchery POS + GCP + your ETL script**.

Below is **what to document**, **which diagrams to draw**, and **accurate technical facts** sourced from this repo and the ETL you supplied.

### B.1 Introduction (Section 1)

Suggested content:

- **Business context**: Multi-location butcher; need unified OLTP, stock discipline, wastage tracking, and franchise-ready analytics.
- **Product aim**: Web POS + admin master data + inventory + BigQuery reporting after controlled ETL.
- **Scope**: Cloud-hosted OLTP and warehouse; no on-prem servers; ETL as a managed Cloud Run HTTP function; reporting embedded in the SPA (not Tableau in this project — say so clearly).
- **Definitions table**: POS, ETL, OLTP, DWH, BI, GCP (Cloud Run, Cloud SQL, BigQuery), `shop_id` scoping, etc.
- **Contribution table**: List each member and deliverables (diagrams, report sections, testing, deployment).

### B.2 System Architecture — ETL (Template §2.1, marks ~2)

**Diagram type**: **Deployment diagram** (recommended) or high-level component diagram.

**Nodes to show** (adjust naming to match your diagram tool):

1. **Operational DB**: Cloud SQL PostgreSQL (`ops_store` / your DB name) — source of truth for dimensions and facts at grain of `sales`, `sale_items`, `wastage`, etc.
2. **ETL runtime**: Cloud Run service executing your Python (`functions_framework`, `pandas`, SQLAlchemy + Connector).
3. **Warehouse**: BigQuery project + dataset `Our_data_warehouse`.
4. **Optional**: Arrow from POS Cloud Run → ETL trigger (HTTP GET/POST as implemented) → ETL reads Cloud SQL → writes BigQuery.

**Description paragraph ideas**:

- **Extract**: SQL via SQLAlchemy+pandas `read_sql` from Postgres (dimensions full snapshots; facts incremental by timestamp watermark read from BigQuery `MAX(...)`).
- **Transform**: pandas — revenue, COGS, profit, tax (10%), hour/day labels; promotion filtering; string normalisation (e.g. title case product names, upper categories/reasons).
- **Load**: `load_table_from_dataframe` with `WRITE_TRUNCATE` for dimensions and `WRITE_APPEND` for facts.

Reference the **exact dimension/fact names** from [ETL pipeline](#etl-pipeline-cloud-run--behaviour) below.

### B.3 System Architecture — Reporting application (Template §2.2, marks ~3)

**Diagram type**: **UML component/class-style** “reporting slice” — not every React component, but **layers**:

- **Browser**: React SPA (pages: POS, Wastage, Reports, Admin CRUD, Inventory).
- **POS Cloud Run service**: FastAPI routers `/api/*`, static files `/`.
- **Cloud SQL**: OLTP reads/writes from routers (`sales`, `inventory`, `wastage`, …).
- **BigQuery**: Read-only from `reports.py` via parameterized SQL.
- **ETL Cloud Run**: Invoked from `/api/etl/sync` before dashboards refresh.

You can draw **one composite diagram** or **per-feature mini architectures** (example report did Login, Order, … — you might do **POS Sale**, **Wastage**, **Reports+ETL**, **Admin Master Data**).

### B.4 ETL task flow design (Template §3, marks ~4)

**Diagram type**: **Activity** or **swimlane** with lanes such as *Scheduler/User*, *ETL Service*, *Cloud SQL*, *BigQuery*.

**Suggested swimlanes for one consolidated diagram**:

1. Trigger (HTTP request / user opens Reports).
2. Connect Postgres (Connector `pg8000`).
3. **Dimension sync** (parallel or sequential): query → dataframe → transform → `WRITE_TRUNCATE` to `dim_products`, `dim_promotions`, `dim_shops`, `dim_staff`, `dim_customers`.
4. **Fact 1 — Sales**: read `max(sale_timestamp)` from `fact_sales_performance` → incremental SQL on `sale_items` + `sales` + `products` → compute metrics → `WRITE_APPEND`.
5. **Fact 2 — Wastage**: read `max(event_timestamp)` from `fact_wastage_loss` → incremental `wastage` join `products` → `WRITE_APPEND`.
6. **Fact 3 — Marketing**: read `max(sale_timestamp)` from `fact_marketing_impact` → incremental rows where `promo_id IS NOT NULL` → `WRITE_APPEND`.
7. Return HTTP **200** with a **plain-text summary** message (`ETL Success: …`) concatenating dimension sync plus sales/wastage/marketing statuses — unless an exception occurs (**500** with `Critical ETL Error: …`).

If the assignment expects **one diagram per “functional area”**, split into: **Dimension refresh**, **Sales fact load**, **Wastage fact load**, **Marketing fact load** — each with explicit **Extract / Transform / Load** subprocess labels.

### B.5 Reporting application task flow design (Template §4, marks ~6)

Template: if you have **six functional requirements**, six **activity/swimlane** diagrams at design level.

Map **your FR IDs from Assignment 1** to features; example mapping **you must reconcile with your actual FR table**:

| Suggested theme | Implementation entry points | Swimlane actors (example) |
| --- | --- | --- |
| Shop/staff context | `ShopLockGate.jsx`, `SessionContext.jsx` | User, Browser, `/api/shops`, `/api/staff` |
| POS sale | `POS.jsx`, `POST /api/sales` | Cashier, API, Postgres (`sales`, `sale_items`, `inventory`) |
| Wastage | `Wastage.jsx`, `POST /api/wastage` | Staff, API, Postgres (`wastage`, `inventory`) |
| Inventory / restock | `admin/Inventory.jsx`, `/api/inventory` | Manager, API, Postgres (`inventory`) |
| Master data admin | `CrudTable.jsx`, `/api/products`, categories, suppliers, … | Manager, API, Postgres |
| Reports + ETL | `Reports.jsx`, `POST /api/etl/sync`, `/api/reports/*` | Analyst, POS backend, ETL service, BigQuery |

For **each** diagram, add a **short table** (like the example report): Case ID, FR ID, description, basic flow, alternatives, pre/post conditions.

### B.6 Interface design (Template §5)

#### 5.1 ETL interface design (marks ~4)

There is **no separate ETL GUI**. The **interface** is:

- **Indirect**: Reports page **button/spinner** → triggers `POST /api/etl/sync`.
- **Technical**: Cloud Run logs / response payload.

For the report, draw **one “ETL interface” diagram per convention**: **User → Reports UI → API `/etl/sync` → ETL Cloud Run → BigQuery**, with annotations for success/failure (502 if ETL unreachable). State honestly that operators do not edit ETL mappings in-app.

#### 5.2 Application navigation design (marks ~2)

Draw a **box diagram**: **Shop lock** → **POS (home)** branches to **Wastage**, **Reports**, **Admin** (Products, Categories, Suppliers, Customers, Promotions, Staff, Shops, **Inventory**) → **Switch shop/staff**.

Mirror routes in `frontend/src/App.jsx` and `Layout.jsx`.

#### 5.3 Application user interface design (marks ~4)

Screenshots with captions:

- Shop/staff lock modal.
- POS grid + cart + payment + stock hints.
- Wastage form + on-hand helper text.
- Inventory restock + stock table.
- One admin CRUD example (e.g. Products).
- Reports: KPI cards + charts + scope dropdown + date range + “Refresh data”.

Tag each with **`[UI Design ID]`** and **`[Functional Requirement ID]`** exactly as your group defines them.

### B.7 Hardware and software tools (Template §6)

- **Hardware**: Staff devices (PC/tablet), browser; optional second monitor; cloud runs on Google infrastructure (document as “hosted — no local warehouse server”).
- **Software**: Python 3, Node.js/npm, PostgreSQL (Cloud SQL), BigQuery, Docker, `gcloud`, libraries listed in **Stack** table.

Optional small diagram: **Browser ↔ FastAPI ↔ Cloud SQL / BigQuery ↔ ETL**.

### B.8 System testing (Template §7, marks ~8)

#### 7.1 Final system URLs & artefact locations

Fill in **when published**:

| Item | Where to record |
| --- | --- |
| Deployed POS URL | Cloud Run URL (`https://….run.app`) |
| GitHub repository | Public/private repo URL — **this README must exist** |
| OLTP | Cloud SQL instance id + database name (no passwords) |
| Warehouse | GCP project + BigQuery dataset `Our_data_warehouse` |
| ETL | Cloud Run service URL for ETL |

#### 7.2 Test procedure

Follow a numbered procedure (environment ready → open browser → run cases → log incidents → summarise). Reference Godfrey-style structure if your subject outline requires it.

#### 7.3 Test cases (marks ~6)

Design **at least six** cases tied to **your FR IDs**. Example **themes** (rewrite to match your specification wording):

1. Shop/staff selection persists and constrains API payloads.
2. Complete sale reduces inventory and rejects oversell.
3. Wastage rejected when quantity exceeds on-hand stock.
4. Restock increases inventory and updates last restock timestamp.
5. Admin CRUD on a master entity (e.g. product) validates constraints.
6. Reports: ETL completes then KPI/charts load; changing `shop_id` scope changes aggregates.

Each case: **identifier**, **FR ID**, **environment needs**, **inputs → expected outputs** table.

#### 7.4 Test results

Tables for **two browsers or OS** if required; **incident report** rows for failures with honest reasons (e.g. demo mode vs production).

---

## Operational database (OLTP) schema summary

Enterprise PostgreSQL schema (teaching DDL excerpt — fix spacing/`NOT NULL` when you paste into the report). Tables:

| Table | Role |
| --- | --- |
| `shops` | Locations |
| `shop_staff` | Staff belonging to a shop |
| `product_categories`, `suppliers`, `customers`, `promotions` | Dimensions / masters |
| `products` | SKU catalogue (`unit_price`, `cost_price`, `unit_measure`, FKs) |
| `sales` | Header: shop, staff, optional customer/promo, payment, total, timestamp |
| `sale_items` | Lines: quantity, price, discount; FK `sale_id` ON DELETE CASCADE |
| `inventory` | Per `(shop_id, product_id)` stock + `last_restock_date` |
| `wastage` | Shop, product, quantity, reason, timestamp — **running system also stores `staff_id`** for accountability and ETL joins |

**Report note**: If your written DDL omits `staff_id` on `wastage`, add an appendix sentence: *live schema includes `staff_id` aligned with the application and ETL.*

---

## ETL pipeline (Cloud Run) — behaviour

The warehouse loader is a **separate Cloud Run service** (your deployed bundle uses **`functions_framework.http`** with handler **`run_etl_process`**). Configuration lives at the top of that script: **GCP project id**, **`INSTANCE_CONNECTION_NAME`** (`project:region:butchery-ops-db`), **Cloud SQL** credentials (`DB_USER`, `DB_PASS`, `DB_NAME`), and **`DATASET`** (typically `Our_data_warehouse`).

### End-to-end flow

1. **Connect**: Cloud SQL Python Connector + SQLAlchemy `create_engine("postgresql+pg8000://", creator=getconn)`.
2. **Dimensions (`WRITE_TRUNCATE`)**: load pandas frames via `read_sql`, then `bigquery.Client.load_table_from_dataframe`.
   - **`dim_products`**: `products` **inner join** `product_categories` and `suppliers` — exposes `product_id`, `product_name`, `category`, `supplier`, `current_retail_price`, `current_cost_price`, **`unit_measure`**. Transformations: `unit_measure` null→empty string; product title-case; category upper-case; price columns as float.
   - **`dim_promotions`**: `promo_id`, `promo_name`, `discount_percent`, `is_active`.
   - **`dim_shops`**, **`dim_staff`**, **`dim_customers`**: `SELECT *` from OLTP mirror tables.
3. **Facts (`WRITE_APPEND`, incremental)** — each reads **`MAX(timestamp)`** from the target BigQuery table (fallback **1970-01-01** if missing/error):
   - **`fact_sales_performance`**: join `sale_items` ↔ `sales` ↔ `products` where `sales.created_at > watermark`; derive gross/net revenue, COGS, profit, tax (~10%), `hour_of_day`, `day_name`.
   - **`fact_wastage_loss`**: `wastage` ↔ `products` where `wastage.created_at > watermark`; includes **`staff_id`**; derives `total_loss_value`; uppercases `reason`.
   - **`fact_marketing_impact`**: sale lines where **`promo_id IS NOT NULL`** and `created_at > watermark`; captures quantities and discount vs pre-discount gross.

Incremental predicates embed the watermark inside SQL built as Python strings (not parameterized bind placeholders). That matches your running implementation but is brittle from an injection standpoint — timestamps originate only from BigQuery max-queries.

### Dimensions — full refresh (`WRITE_TRUNCATE`)

| BigQuery table | Source (Postgres) | Notes |
| --- | --- | --- |
| `dim_products` | `products` INNER JOIN `product_categories`, `suppliers` | Includes **`unit_measure`**; inner joins mean rows **without** category/supplier FKs do **not** appear |
| `dim_promotions` | `promotions` | |
| `dim_shops` | `shops` | |
| `dim_staff` | `shop_staff` | |
| `dim_customers` | `customers` | |

### Facts — incremental (`WRITE_APPEND`)

Watermarks: query **BigQuery** `MAX(timestamp)` per fact table (fallback to epoch if empty/error).

| Fact table | Grain | Incremental filter | Key metrics computed in ETL |
| --- | --- | --- | --- |
| `fact_sales_performance` | Sale line + product cost snapshot | `sales.created_at > watermark` | `gross_revenue`, `net_revenue`, `total_cogs`, `net_profit`, `tax_amount` (~10%), `hour_of_day`, `day_name` |
| `fact_wastage_loss` | Wastage event | `wastage.created_at > watermark` | `total_loss_value = quantity_wasted * cost_price`, reason uppercased |
| `fact_marketing_impact` | Sale lines with promo | `promo_id IS NOT NULL` and `created_at > watermark` | Pre-discount gross, discount given, quantities |

**Success response**: HTTP **200** body is a single string such as `ETL Success: Added … | … | …` (not JSON). The POS backend treats non-JSON bodies gracefully where implemented.

**Partitioning** (warehouse DDL): facts partitioned by `DATE(..._timestamp)`.

---

## Data warehouse (BigQuery) schema summary

Dataset: **`Our_data_warehouse`** (adjust if renamed).

**Dimensions**: `dim_products` (including **`unit_measure`** from OLTP), `dim_shops`, `dim_staff`, `dim_customers`, `dim_promotions`.

**Facts**: `fact_sales_performance`, `fact_wastage_loss`, `fact_marketing_impact` — columns as in your BigQuery `CREATE TABLE` definitions; Reports router queries these names.

---

## Application backend & frontend map

### Key API groups (`/api/...`)

| Prefix | Purpose |
| --- | --- |
| `/shops`, `/staff` | Locations and staff lists |
| `/categories`, `/suppliers`, `/customers`, `/promotions`, `/products` | Admin CRUD |
| `/inventory` | List by shop; restock |
| `/sales` | List; create sale + items + stock decrement |
| `/wastage` | List; create wastage + stock decrement |
| `/etl/sync` | Proxy trigger to ETL Cloud Run |
| `/reports/*` | KPIs, trends, velocity, products, categories, wastage, staff, promo ROI |

### Reports endpoints (for citing in report)

Reports module queries BigQuery with optional **`shop_id`** — omit for franchise-wide aggregates.

Typical endpoints: `kpis`, `revenue-trend`, `sales-velocity`, `top-products`, `category-mix`, `wastage-summary`, `staff-performance`, `promo-roi` (exact paths under `/api/reports/` in `backend/routers/reports.py`).

---

## Marking sheet alignment (quick reference)

| Component (from sheet) | Where this README helps |
| --- | --- |
| ETL Architecture §2.1 | Deployment diagram + narrative + [ETL pipeline](#etl-pipeline-cloud-run--behaviour) |
| Reporting Application Architecture §2.2 | Layers POS ↔ API ↔ OLTP/BQ/ETL |
| ETL Task Flow §3 | Swimlanes + Extract/Transform/Load |
| Reporting Task Flow §4 | Per-FR flows + tables |
| ETL Interface §5.1 | Reports trigger + API — no standalone ETL UI |
| Navigation §5.2 | Routes from `App.jsx` / `Layout.jsx` |
| UI §5.3 | Screenshots + FR/UI IDs |
| Code / DW implementation | Honest description + GitHub + GCP locations |
| Testing §7 | Procedure + FR-linked cases + results |
