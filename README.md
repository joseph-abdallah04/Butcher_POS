# Butchery POS

**LAUNCH THE APP WITH THIS LINK:** https://butchery-pos-484746792604.australia-southeast1.run.app/ 

A franchise-aware point-of-sale and reporting system for a butchery chain, built for **41091 Data Systems — Assignment 2**.

The app handles day-to-day operations (sales, wastage, inventory, master data) on top of a Cloud SQL PostgreSQL OLTP database, and powers analytics dashboards from a BigQuery warehouse populated by a separate Cloud Run ETL job.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy, Pydantic v2 |
| OLTP | Cloud SQL for PostgreSQL (via `cloud-sql-python-connector`) |
| Warehouse | BigQuery (`Our_data_warehouse`) |
| ETL | Cloud Run service (Python, pandas, `functions_framework.http`) |
| Hosting | Cloud Run (single Dockerfile serves API + built SPA) |

## Repository layout

```
Butcher_POS/
  backend/        # FastAPI app, routers, models, schemas
  frontend/       # React SPA (POS, Wastage, Reports, Admin)
  ETL Pipeline/   # Reference ETL script + warehouse/OLTP DDL
  Dockerfile      # Multi-stage build: npm build → Python image + SPA
```

## Quick start

**Demo mode** (UI only, in-memory mock data, no cloud needed):

```bash
cd frontend && npm install && npm run demo
```

**Local dev against real Cloud SQL + BigQuery:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values

gcloud auth application-default login
cd .. && uvicorn backend.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173` and pick a shop + staff member on the lock screen.

## Key features

- **POS** — record sales with stock checks, customer/promo attachment, and atomic inventory decrement.
- **Wastage** — log losses by reason with the same stock discipline.
- **Inventory** — per-shop stock and restocks.
- **Admin CRUD** — products, categories, suppliers, customers, promotions, staff, shops (manager-only).
- **Reports** — triggers an ETL sync, then renders KPI cards and charts (revenue trend, sales velocity, top products, category mix, wastage, staff performance, promo ROI) scoped by shop and date range.

## Documentation

For full architecture, schema, ETL behaviour, and assignment-report guidance, see [`SYSTEM_CONTEXT.md`](./SYSTEM_CONTEXT.md) and [`ETL Pipeline/ETL_CONTEXT.md`](./ETL%20Pipeline/ETL_CONTEXT.md).
