"""Trigger the BigQuery ETL Cloud Run service and return its JSON response."""

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/etl", tags=["etl"])

ETL_URL = "https://run-butchery-etl-484746792604.australia-southeast1.run.app"


@router.post("/sync")
def sync_to_bigquery():
    try:
        response = httpx.get(ETL_URL, timeout=120)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach ETL service: {exc}",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"ETL service returned {response.status_code}: {response.text}",
        )

    try:
        return response.json()
    except ValueError:
        return {"raw": response.text}
