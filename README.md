# Butchery POS

A point-of-sale web app for a butchery business. Staff lock to a shop, ring up
sales and log wastage into a Google Cloud SQL (Postgres) operating database,
trigger a Cloud Run ETL pipeline that loads the data warehouse, and view
real-time business insights pulled live from BigQuery.

- **Backend** - FastAPI, SQLAlchemy, `cloud-sql-python-connector[pg8000]`, `google-cloud-bigquery`
- **Frontend** - React 18 + Vite + Tailwind + Recharts
- **Operating DB** - Cloud SQL for Postgres (existing star schema source)
- **Data warehouse** - BigQuery (`Our_data_warehouse` dataset, 5 dimension tables + 3 fact tables)
- **Deploy target** - one Cloud Run service that serves both the API and the React bundle

## Project structure

```
Butcher_POS/
  Dockerfile                  multi-stage: build React, then Python runtime
  backend/
    main.py                   FastAPI app, mounts /api and the SPA
    database.py               Cloud SQL Connector + SQLAlchemy engine
    bigquery_client.py        Lazily-initialised BigQuery client
    models.py                 ORM models matching the existing OLTP schema
    schemas.py                Pydantic v2 request/response models (with enums)
    routers/                  shops, staff, categories, suppliers, customers,
                              promotions, products, sales, wastage, etl, reports
    requirements.txt
    .env.example
  frontend/
    src/
      App.jsx                 router
      main.jsx                bootstraps providers
      api.js                  thin fetch wrapper (with demo-mode shim)
      demo.js                 in-memory mock data for offline preview
      context/SessionContext.jsx     shop+staff session
      components/             ShopLockGate, Layout, Modal, Toast, CrudTable
      pages/                  POS, Wastage, Reports, Sync, admin/*
```

## Quickest preview (no Cloud setup)

You can launch the UI with mocked data in under a minute:

```bash
cd frontend
npm install
npm run demo          # serves on http://localhost:5173 with VITE_DEMO=true
```

A yellow banner at the top of every page shows you're in demo mode. The
Reports page shows representative dummy charts. Nothing persists.

## Local dev against the real Google Cloud stack

Two terminals.

### Terminal 1 - backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in real values

# ADC for both Cloud SQL Connector and BigQuery client
gcloud auth application-default login

cd ..
uvicorn backend.main:app --reload --port 8000
```

### Terminal 2 - frontend

```bash
cd frontend
npm install
npm run dev          # Vite on :5173, proxies /api to :8000
```

Open <http://localhost:5173>, choose a shop and a staff member, and you're in.

### Required environment variables

| Variable | Example | Purpose |
| --- | --- | --- |
| `DB_USER` | `pos-app` | Postgres role on the Cloud SQL instance |
| `DB_PASS` | `s3cret` | Postgres password |
| `DB_NAME` | `butchery` | Postgres database name |
| `INSTANCE_CONNECTION_NAME` | `my-project:australia-southeast1:butchery-sql` | `project:region:instance` |
| `PRIVATE_IP` | empty | Set to a non-empty value to use the instance's private IP |
| `BQ_PROJECT_ID` | `my-project` | GCP project that owns the BigQuery warehouse |
| `BQ_DATASET` | `Our_data_warehouse` | Dataset name (defaults to `Our_data_warehouse`) |
| `EXTRA_CORS_ORIGINS` | empty | Comma-separated extra origins for local dev |

Template lives in `backend/.env.example`.

## Deploy to Cloud Run

The whole stack ships as one Cloud Run service. From the repo root:

```bash
PROJECT=my-project
REGION=australia-southeast1
INSTANCE=$PROJECT:$REGION:butchery-sql

gcloud run deploy butchery-pos \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE \
  --set-env-vars "DB_USER=pos-app,DB_PASS=*****,DB_NAME=butchery,INSTANCE_CONNECTION_NAME=$INSTANCE,BQ_PROJECT_ID=$PROJECT,BQ_DATASET=Our_data_warehouse"
```

Cloud Run builds the `Dockerfile` automatically. After the first deploy, open
the printed URL - the React UI is at `/` and the API is at `/api/*`.

### IAM grants the Cloud Run service account needs

```bash
SA=$(gcloud run services describe butchery-pos --region $REGION --format='value(spec.template.spec.serviceAccountName)')

gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/bigquery.dataViewer"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/bigquery.jobUser"
```

If your ETL Cloud Run service requires authentication, also grant the POS
service account `roles/run.invoker` on the ETL service.

## Design notes

### Shop + Staff session lock

The spec asks for a Shop-Lock pseudo-login, but `sales` and `wastage` both
have `staff_id NOT NULL`. The lock screen asks for **both** a shop and a
staff member. Both are stored in `localStorage` under one React Context and
attached to every mutating request. "Switch shop / staff" in the sidebar
clears the session.

### Defensive transaction handling

`POST /api/sales` wraps the parent insert and the children inserts in a
single SQLAlchemy `db.begin()` block. If any child item violates a foreign
key, the whole transaction rolls back and the API returns HTTP 400 with the
DB error in `detail`, which the frontend surfaces in a red toast.

The total amount is recomputed server-side from the items
(`sum(quantity * price_at_sale - discount_applied)`). The `payment_method`
field is a Pydantic enum (`Cash` / `Card` / `EFTPOS`), so a tampered client
cannot insert garbage. `WastageCreate.reason` is also an enum
(`Expired`, `Fridge Failure`, `Spoiled`, `Damaged`, `Cross-Contamination`,
`Cutting Error`, `Other`) to align with the BI dimension on the warehouse
side.

### Reporting page (BigQuery-backed)

The Reports page hits 8 dedicated endpoints under `/api/reports/*`, each
running a single parameterised SQL query against the warehouse:

| Endpoint | Source tables | Purpose |
| --- | --- | --- |
| `/kpis` | `fact_sales_performance`, `fact_wastage_loss` | Headline KPI cards |
| `/revenue-trend` | `fact_sales_performance` | Daily revenue / profit / transactions line chart |
| `/sales-velocity` | `fact_sales_performance` | Hour-of-day and day-of-week bar charts |
| `/top-products` | `fact_sales_performance`, `dim_products` | Top 10 by net profit |
| `/category-mix` | `fact_sales_performance`, `dim_products` | Category donut |
| `/wastage-summary` | `fact_wastage_loss`, `dim_products` | Loss by reason + top wasted SKUs |
| `/staff-performance` | `fact_sales_performance`, `dim_staff` | Per-staff sales table |
| `/promo-roi` | `fact_marketing_impact`, `dim_promotions` | Promotional cannibalisation |

All eight endpoints take an optional query parameter ``shop_id``. When it is
**present**, results are scoped to that location. When it is **omitted**,
BigQuery aggregates across **every shop** in the franchise (franchise-wide
reporting). The Reports UI defaults to the locked shop and includes a
dropdown to switch between **current shop**, **all locations**, or **another
specific shop**.

When the user opens the Reports page the frontend first calls
`POST /api/etl/sync` and **blocks** the UI with a spinner until the Cloud
Run ETL completes, *then* loads the eight report endpoints in parallel.
This guarantees the BI dashboards always reflect the latest sales and
wastage that have been entered through the POS today. Changing the date
range refetches the charts but does not re-trigger the ETL.

### One Cloud Run service for everything

The Dockerfile is a two-stage build: stage 1 runs `npm run build` to
produce `frontend/dist`, stage 2 copies that into the Python image and
FastAPI serves it via `StaticFiles`. Same origin for API and UI means no
CORS headaches and a single URL for users.
