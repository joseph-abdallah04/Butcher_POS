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
7. [Reporting metrics & ETL-to-dashboard mapping](#reporting-metrics--etl-to-dashboard-mapping)
8. [Marking sheet alignment (quick reference)](#marking-sheet-alignment-quick-reference)

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

- **Extract**: SQL via SQLAlchemy+pandas `read_sql` from Postgres — dimensions and facts are read as **full snapshots** for each sync (no BigQuery watermark or “since last run” filter).
- **Transform**: pandas — revenue, COGS, profit, tax (10%), hour/day labels; promotion filtering; string normalisation (e.g. title case product names, upper categories/reasons).
- **Load**: `bigquery.Client.load_table_from_dataframe` — dimension tables are **replaced** from each run’s dataframe; each fact table is **cleared for the run** then **loaded** with the freshly built rows so the warehouse matches current OLTP content.

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
3. **Dimension sync** (parallel or sequential): query → dataframe → transform → load into `dim_products`, `dim_promotions`, `dim_shops`, `dim_staff`, `dim_customers` so each table reflects **only** the current extraction.
4. **Fact 1 — Sales**: SQL on `sale_items` + `sales` + `products` (full extract) → compute line metrics → load into **`fact_sales_performance`** after clearing that fact for the run.
5. **Fact 2 — Wastage**: `wastage` join `products` (full extract) → derive loss fields → load into **`fact_wastage_loss`** after clearing that fact for the run.
6. **Fact 3 — Marketing**: sale lines where **`promo_id IS NOT NULL`** (full extract) → load into **`fact_marketing_impact`** after clearing that fact for the run.
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

The warehouse loader is a **separate Cloud Run service** — **not part of this Git repo**. Maintain its Python bundle (`main.py`, `requirements.txt`, etc.) wherever your group keeps deployment sources (zip upload to Cloud Run, another repo, or coursework artefact). This codebase only **calls** that service via `backend/routers/etl.py`.

Your deployed bundle uses **`functions_framework.http`** with handler **`run_etl_process`**. Configuration lives at the top of that script: **GCP project id**, **`INSTANCE_CONNECTION_NAME`** (`project:region:butchery-ops-db`), **Cloud SQL** credentials (`DB_USER`, `DB_PASS`, `DB_NAME`), and **`DATASET`** (typically `Our_data_warehouse`).

### End-to-end flow

1. **Connect**: Cloud SQL Python Connector + SQLAlchemy `create_engine("postgresql+pg8000://", creator=getconn)`.
2. **Dimensions**: read OLTP into pandas via `read_sql`, apply transforms, then load with **`bigquery.Client.load_table_from_dataframe`** so each dimension table is **replaced** by the current snapshot.
   - **`dim_products`**: `products` **inner join** `product_categories` and `suppliers` — exposes `product_id`, `product_name`, `category`, `supplier`, `current_retail_price`, `current_cost_price`, **`unit_measure`**. Transformations: `unit_measure` null→empty string; product title-case; category upper-case; price columns as float.
   - **`dim_promotions`**: `promo_id`, `promo_name`, `discount_percent`, `is_active`.
   - **`dim_shops`**, **`dim_staff`**, **`dim_customers`**: `SELECT *` from OLTP mirror tables.
3. **Facts** — for each fact, the job **clears the target BigQuery table for that run**, reads **all** matching OLTP rows (see reference `ETL Pipeline/etl_pipeline.py`), transforms where applicable, then loads the new rows:
   - **`fact_sales_performance`**: `sale_items` ⋈ `sales` ⋈ `LEFT JOIN products`; derive gross/net revenue, COGS, profit, tax (~10%), `hour_of_day`, `day_name`.
   - **`fact_wastage_loss`**: `wastage` ⋈ `LEFT JOIN products`; includes **`staff_id`**; derives `total_loss_value`; uppercases `reason`.
   - **`fact_marketing_impact`**: sale lines where **`promo_id IS NOT NULL`**; captures quantities and discount vs pre-discount gross.

### Dimensions — snapshot each sync

| BigQuery table | Source (Postgres) | Notes |
| --- | --- | --- |
| `dim_products` | `products` INNER JOIN `product_categories`, `suppliers` | Includes **`unit_measure`**; inner joins mean rows **without** category/supplier FKs do **not** appear |
| `dim_promotions` | `promotions` | |
| `dim_shops` | `shops` | |
| `dim_staff` | `shop_staff` | |
| `dim_customers` | `customers` | |

### Facts — snapshot each sync

Each fact reload is a **full extract** from OLTP for that grain; there is **no** “load only rows newer than the last warehouse timestamp” step.

| Fact table | Grain | Extract scope | Key metrics computed in ETL |
| --- | --- | --- | --- |
| `fact_sales_performance` | Sale line + product cost snapshot | All `sale_items` joined to `sales` (with product cost) | `gross_revenue`, `net_revenue`, `total_cogs`, `net_profit`, `tax_amount` (~10%), `hour_of_day`, `day_name` |
| `fact_wastage_loss` | Wastage event | All `wastage` rows joined to products for cost | `total_loss_value = quantity_wasted * cost_price`, reason uppercased |
| `fact_marketing_impact` | Sale lines with promo | All lines where `promo_id IS NOT NULL` | Pre-discount gross, discount given, quantities |

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

### Roles, Admin CRUD, and operational writes

The lock screen records **which staff member** is on shift (`shop_staff.id` + **`role`** text, e.g. `Manager`, `Butcher`, `Cashier`). The SPA only shows **Admin** nav links when **`role`** is **`Manager`** (case-insensitive). The API still enforces the same rule on sensitive routes using the **`X-Acting-Staff-Id`** header (set from that session for every request).

| Area | **Manager** | **Other roles** (Butcher, Cashier, …) |
| --- | --- | --- |
| **Admin tabs** (Inventory restock, Products, Categories, Suppliers, Customers, Promotions, Staff, Shops) | Visible in the UI; **create / update / delete** allowed where the API checks `require_manager`. | **Hidden** in the UI; direct API calls to those write endpoints return **403** (or **401** if the header is missing). |
| **`GET /suppliers`** | Allowed (used when editing products). | **Not** allowed — suppliers list is manager-only so supplier master data is not exposed to non-managers. |
| **Reads for POS / Wastage** (`GET /products`, `GET /categories`, `GET /customers`, `GET /promotions`, `GET /inventory`, `GET /wastage`, …) | Allowed. | Allowed — needed to run the till and log wastage. |
| **`POST /shops`** (create shop from lock screen) | Allowed. | Allowed — so the **first** shop can be created before any manager exists in the database. |
| **`PUT` / `DELETE` on `/shops/{id}`** | Allowed. | **403** — only managers may rename/remove shops. |
| **`/staff` CRUD** (global staff admin, not “staff for this shop” on the lock screen) | Allowed. | **403** — lock-screen staff list uses **`GET /shops/{shop_id}/staff`**, which is **not** under this restriction. |
| **Reports + ETL trigger** | Allowed (same as other roles today). | Same — not gated by manager in the backend; any logged-in staff can open **Reports** and refresh analytics. |

**Non-managers cannot use Admin tabs** — but they still change live data through **operational** screens (this is intentional “CRUD through the app”, not through master-data forms):

| Action | Where in the app | What gets written |
| --- | --- | --- |
| **Record a sale** | **POS** | Inserts **`sales`** + **`sale_items`**; decrements **`inventory`** for each line; may attach **`customer_id`**, **`promo_id`**, payment method, totals. |
| **Log wastage** | **Wastage** | Inserts **`wastage`** (shop, product, quantity, reason, staff); decrements **`inventory`** when quantity is on hand. |

Those flows use **`POST /sales`** and **`POST /wastage`** (with validation such as stock checks). They do **not** require the Manager role. After the next **ETL** run, sales and wastage feed the warehouse facts used on **Reports**.

**Implementation pointers:** UI gating — `frontend/src/components/Layout.jsx`, `frontend/src/App.jsx`. Header + manager dependency — `frontend/src/api.js`, `backend/deps.py`, and the individual routers under `backend/routers/` (see `require_manager` on mutating handlers).

### Reports endpoints (for citing in report)

Reports module queries BigQuery with optional **`shop_id`** — omit for franchise-wide aggregates.

Typical endpoints: `kpis`, `revenue-trend`, `sales-velocity`, `top-products`, `category-mix`, `wastage-summary`, `staff-performance`, `promo-roi` (exact paths under `/api/reports/` in `backend/routers/reports.py`).

---

## Reporting metrics & ETL-to-dashboard mapping

This section ties together **(1)** column-level transforms in **`ETL Pipeline/etl_pipeline.py`**, **(2)** SQL aggregations in **`backend/routers/reports.py`**, and **(3)** what appears on **`frontend/src/pages/Reports.jsx`**. If your deployed ETL bundle diverges from the repo file, treat that bundle as the source of truth for production numbers and reconcile this table with your live script.

### End-to-end flow

1. **OLTP** (Postgres) — source rows: `sale_items` + `sales`, `wastage`, promo sale lines, and dimension masters.  
2. **ETL** — builds/loads BigQuery tables (`dim_*`, `fact_*`) and **computes fact columns** (revenue, COGS, tax, etc.).  
3. **`/api/reports/*`** — parameterized BigQuery SQL **aggregates** (`SUM`, `COUNT`, `SAFE_DIVIDE`, `GROUP BY`) over those facts for the selected date range and optional `shop_id`.  
4. **Reports page** — charts/tables bind to the JSON fields returned by those endpoints (plus two **client-side** rollups for velocity bars).

---

### ETL transforms (`ETL Pipeline/etl_pipeline.py`)

#### Dimensions (used when reports `JOIN` dimensions)

| Target table | Extract | Transform (in Python) | Used on Reports for |
| --- | --- | --- | --- |
| **`dim_products`** | `products` ⋈ `product_categories` ⋈ `suppliers` | `unit_measure` → `fillna('')` + string; `product_name` → **title case**; `category` → **UPPER**; retail/cost prices → `float` | **Top products** & **wastage-by-product** (`product_name`, `category`, **`unit_measure`**); **category mix** (`category`); joins for staff/promo tables are separate dims. |
| **`dim_promotions`** | `promotions` | `discount_percent` → `float` | **Promotional ROI** (`promo_name`, `discount_percent`). |
| **`dim_shops`**, **`dim_staff`** (Postgres **`shop_staff`**), **`dim_customers`** | `SELECT *` | Loaded as-is (typed by driver) | **Staff performance** (`staff_name`, `role` from `dim_staff`); promo/customer labels indirect via facts. |

#### Fact 1 — `fact_sales_performance` (sale line grain)

**Extract** (SQL in ETL): `sale_items` ⋈ `sales` ⋈ `LEFT JOIN products` — line `quantity`, `price_at_sale`, `discount_applied`, `COALESCE(products.cost_price, 0)` as `cost_price`, header `created_at` as `sale_timestamp`, plus ids (`sale_id`, `shop_id`, `staff_id`, `product_id`).

**Transform** (pandas, same file):

| Column | Formula / rule |
| --- | --- |
| `gross_revenue` | `quantity * price_at_sale` |
| `net_revenue` | `gross_revenue - discount_applied` |
| `total_cogs` | `quantity * cost_price` |
| `net_profit` | `net_revenue - total_cogs` |
| `tax_amount` | `net_revenue * 0.1`, rounded to **2** decimal places (fixed **10%** model on net revenue) |
| `hour_of_day` | `sale_timestamp.dt.hour` |
| `day_name` | `sale_timestamp.dt.day_name()` (e.g. `Monday`) |

**Load:** each sync **rebuilds** the fact table from the OLTP extract for that run (see reference `ETL Pipeline/etl_pipeline.py`).

#### Fact 2 — `fact_wastage_loss` (one row per wastage event)

**Extract:** `wastage` ⋈ `LEFT JOIN products` — `quantity_wasted`, `reason`, `COALESCE(cost_price, 0)`, `created_at` → `event_timestamp`, ids.

**Transform:**

| Column | Formula / rule |
| --- | --- |
| `total_loss_value` | `quantity_wasted * cost_price` |
| `reason` | **UPPER**-cased string |

#### Fact 3 — `fact_marketing_impact` (sale lines where `promo_id` is set)

**Extract:** `sales` ⋈ `sale_items` with `WHERE s.promo_id IS NOT NULL`; exposes `quantity`, `discount_applied` as `discount_value_given`, `(quantity * price_at_sale)` as `gross_revenue_pre_discount`, `sale_timestamp`.

**Transform:** numeric casts to `float` for `quantity`, `discount_value_given`, `gross_revenue_pre_discount`.

---

### BigQuery aggregations (`backend/routers/reports.py`)

Unless noted, filters are **`DATE(sale_timestamp)`** or **`DATE(event_timestamp)`** between `start_date` and `end_date`, plus optional **`shop_id`**.

#### `GET /reports/kpis` → KPI cards

| JSON field | BigQuery definition | ETL column(s) feeding it |
| --- | --- | --- |
| `gross_revenue` | `SUM(gross_revenue)` | `fact_sales_performance.gross_revenue` |
| `net_revenue` | `SUM(net_revenue)` | `net_revenue` |
| `net_profit` | `SUM(net_profit)` | `net_profit` |
| `total_cogs` | `SUM(total_cogs)` | `total_cogs` |
| `total_tax` | `SUM(tax_amount)` | **`tax_amount`** |
| `transactions` | `COUNT(DISTINCT sale_id)` | distinct headers represented at line grain |
| `avg_basket` | `SAFE_DIVIDE(SUM(net_revenue), COUNT(DISTINCT sale_id))` | derived from same sums |
| `total_loss_value` | `SUM(total_loss_value)` on wastage fact | **`fact_wastage_loss.total_loss_value`** |
| `wastage_events` | `COUNT(*)` wastage rows | row count in range |
| `start_date`, `end_date` | Echo of query window | — |

#### `GET /reports/revenue-trend` → “Net revenue, profit, and transactions over time”

Per **`sale_date`** (`DATE(sale_timestamp)`): `SUM(gross_revenue)`, `SUM(net_revenue)`, `SUM(net_profit)`, `COUNT(DISTINCT sale_id)` as **`transactions`**. All from **`fact_sales_performance`**.

#### `GET /reports/sales-velocity` → hourly / daily velocity charts (after UI rollup)

Returns one row per **`(day_name, hour_of_day)`** from the fact: `SUM(net_revenue)`, `COUNT(DISTINCT sale_id)` as **`transactions`**. Uses ETL columns **`day_name`** and **`hour_of_day`**. The **bar charts** on the Reports page **re-sum** those rows in the browser by hour-only and by day-only (see below).

#### `GET /reports/top-products`

Per product: `SUM(quantity)` → **`units_sold`**, `SUM(net_revenue)`, `SUM(net_profit)`; joins **`dim_products`** for name, category, and **`unit_measure`** (SQL coalesces empty to **`—`**).

#### `GET /reports/category-mix`

Per category (from `dim_products`, default **`Uncategorised`**): `SUM(net_revenue)`, `SUM(net_profit)`, `SUM(quantity)` → **`units`**. Pie uses **`net_revenue`**.

#### `GET /reports/wastage-summary`

- **`by_reason`:** `reason`, `SUM(total_loss_value)`, `SUM(quantity_wasted)`, `COUNT(*)` as **`events`**. The main wastage bar chart plots **`total_loss_value`** only.  
- **`by_product`:** product + category + **`unit_measure`** from `dim_products`, `SUM(total_loss_value)`, `SUM(quantity_wasted)`, `COUNT(*)` as **`events`**. Table shows qty with unit suffix.

#### `GET /reports/staff-performance`

Per staff: `COUNT(DISTINCT sale_id)` **`transactions`**, `SUM(net_revenue)`, `SUM(net_profit)`, `SAFE_DIVIDE(SUM(net_revenue), COUNT(DISTINCT sale_id))` **`avg_basket`**, plus **`staff_name`**, **`role`** from **`dim_staff`**.

#### `GET /reports/promo-roi`

Per promotion: **`redemptions`** = `COUNT(DISTINCT sale_id)`, **`units_sold`** = `SUM(quantity)`, **`gross_pre_discount`** = `SUM(gross_revenue_pre_discount)`, **`discount_given`** = `SUM(discount_value_given)`, **`net_revenue`** = `SUM(gross_revenue_pre_discount - discount_value_given)`, **`discount_share`** = `SAFE_DIVIDE(SUM(discount_value_given), SUM(gross_revenue_pre_discount))` (ratio; UI shows as percent). Dimension: **`dim_promotions`** for name and `discount_percent`.

---

### Reports UI (`frontend/src/pages/Reports.jsx`) — field binding

| UI block | Data source | Primary fields |
| --- | --- | --- |
| **KPI grid** | `/reports/kpis` | `net_revenue`, `gross_revenue`, `net_profit`, `total_cogs`, `total_tax` (label **Tax paid**), `transactions`, `avg_basket`, `total_loss_value`, `wastage_events` |
| **Line chart** (trend) | `/reports/revenue-trend` | `sale_date`, `net_revenue`, `net_profit`, `transactions` (tooltip uses count formatter for transactions) |
| **Velocity by hour** | `/reports/sales-velocity` → **`aggregateByHour`** | Sums **`net_revenue`** (and keeps **`transactions`**) across all weekdays for each `hour_of_day` |
| **Velocity by weekday** | same → **`aggregateByDay`** | Sums **`net_revenue`** / **`transactions`** per `day_name`, ordered Mon–Sun |
| **Top products** chart + table | `/reports/top-products` | Chart: `product_name`, `net_revenue`, `net_profit`. Table adds `category`, **`unit_measure`**, `units_sold` |
| **Category mix** donut | `/reports/category-mix` | `category`, `net_revenue` |
| **Wastage by reason** bar | `wastage.by_reason` | `reason`, `total_loss_value` |
| **Top wasted products** table | `wastage.by_product` | `product_name`, `category`, **`unit_measure`**, `quantity_wasted`, `events`, `total_loss_value` |
| **Staff performance** table | `/reports/staff-performance` | `staff_name`, `role`, `transactions`, `net_revenue`, `net_profit`, `avg_basket` |
| **Promotional ROI** table | `/reports/promo-roi` | `promo_name`, `discount_percent`, `redemptions`, `units_sold`, `gross_pre_discount`, `discount_given`, `net_revenue`, `discount_share` (label **Margin bleed**) |

---

### Quick reference: ETL line metric → first place it appears on Reports

| ETL-derived fact column | Typical first use on Reports |
| --- | --- |
| `gross_revenue` | KPI **Gross revenue**; revenue trend line; not the main velocity bars (those emphasize **net**). |
| `net_revenue` | KPI **Net revenue**; trend; velocity charts; category mix; top products; staff; promo **net_revenue**. |
| `net_profit` | KPI **Net profit**; trend; top products; staff. |
| `total_cogs` | KPI **COGS**. |
| `tax_amount` | KPI **Tax paid** (`SUM` as `total_tax`). |
| `hour_of_day`, `day_name` | Velocity dataset; then collapsed in UI aggregators. |
| Wastage `total_loss_value` | KPI **Total loss (wastage)**; wastage charts/tables. |
| Wastage `reason` | Grouping in **by_reason** (ETL uppercases; chart shows those values). |
| Marketing `gross_revenue_pre_discount`, `discount_value_given` | Promo ROI **Gross pre-discount**, **Discount given**, **Margin bleed**, **Net revenue** for promo lines. |
| `dim_products.unit_measure` | Top products table; wastage-by-product table/column. |

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
