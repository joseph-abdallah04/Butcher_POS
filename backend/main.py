"""FastAPI entry point for the Butchery POS.

Routes:
    /api/*    - JSON API for the React frontend
    /        - In production, serves the built Vite bundle from frontend/dist

In local dev the frontend runs on Vite (`:5173`) and proxies /api to this
backend on `:8000`. The static mount is a no-op when ``frontend/dist`` does
not exist.
"""

import os
import pathlib

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from .routers import (
    categories,
    customers,
    etl,
    inventory,
    products,
    promotions,
    reports,
    sales,
    shops,
    staff,
    suppliers,
    wastage,
)

app = FastAPI(title="Butchery POS API", version="1.0.0")


_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
_extra = [o.strip() for o in os.environ.get("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=400,
        content={"detail": f"Database constraint violation: {exc.orig}"},
    )


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}


for router in (
    shops.router,
    staff.router,
    categories.router,
    suppliers.router,
    customers.router,
    promotions.router,
    products.router,
    inventory.router,
    sales.router,
    wastage.router,
    etl.router,
    reports.router,
):
    app.include_router(router, prefix="/api")


_DIST_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=_DIST_DIR, html=True), name="spa")
