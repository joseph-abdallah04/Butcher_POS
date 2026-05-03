"""Lazily-initialised BigQuery client.

Auth is via Application Default Credentials. In Cloud Run the service
account on the revision needs ``roles/bigquery.dataViewer`` and
``roles/bigquery.jobUser`` on the warehouse project.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv(Path(__file__).resolve().parent / ".env")


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name!r}. "
            "Set BQ_PROJECT_ID and BQ_DATASET to point at the data warehouse."
        )
    return value


@lru_cache(maxsize=1)
def get_client() -> bigquery.Client:
    return bigquery.Client(project=_required("BQ_PROJECT_ID"))


def dataset() -> str:
    return os.environ.get("BQ_DATASET", "Our_data_warehouse")


def fq(table: str) -> str:
    """Fully-qualified `project.dataset.table` reference for a BQ SQL query."""
    return f"`{_required('BQ_PROJECT_ID')}.{dataset()}.{table}`"


def run_query(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Run a parameterised BQ query and return the rows as plain dicts."""
    job_config = None
    if params:
        query_params = []
        for name, value in params.items():
            param_type = _bq_type(value)
            query_params.append(bigquery.ScalarQueryParameter(name, param_type, value))
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)

    job = get_client().query(sql, job_config=job_config)
    return [dict(row.items()) for row in job.result()]


def _bq_type(value: Any) -> str:
    if isinstance(value, bool):
        return "BOOL"
    if isinstance(value, int):
        return "INT64"
    if isinstance(value, float):
        return "FLOAT64"
    return "STRING"
