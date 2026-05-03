"""Cloud SQL Postgres connection via the official Python Connector.

A single ``Connector`` instance is shared by the whole process so SQLAlchemy's
pool can reuse it (per the recommendation in
https://github.com/GoogleCloudPlatform/cloud-sql-python-connector/issues/772).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# Load backend/.env explicitly so it works no matter where uvicorn is run from.
# In Cloud Run, env vars come from --set-env-vars and this is a no-op.
load_dotenv(Path(__file__).resolve().parent / ".env")


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name!r}. "
            "See backend/.env.example for the full list."
        )
    return value


_connector = Connector(refresh_strategy="LAZY")


def _getconn():
    """Create a new pg8000 DBAPI connection through the Cloud SQL Connector."""
    return _connector.connect(
        _required("INSTANCE_CONNECTION_NAME"),
        "pg8000",
        user=_required("DB_USER"),
        password=_required("DB_PASS"),
        db=_required("DB_NAME"),
        ip_type=IPTypes.PRIVATE if os.environ.get("PRIVATE_IP") else IPTypes.PUBLIC,
    )


engine = create_engine(
    "postgresql+pg8000://",
    creator=_getconn,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=2,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
