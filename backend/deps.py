"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import ShopStaff


def require_manager(
    x_acting_staff_id: str | None = Header(None, alias="X-Acting-Staff-Id"),
    db: Session = Depends(get_db),
) -> ShopStaff:
    """Require the browser session staff (header) to exist and have role Manager."""
    if not x_acting_staff_id or not str(x_acting_staff_id).strip():
        raise HTTPException(
            status_code=401,
            detail="Missing X-Acting-Staff-Id header (pick staff on the lock screen)",
        )
    try:
        sid = int(str(x_acting_staff_id).strip())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid X-Acting-Staff-Id") from exc
    staff = db.get(ShopStaff, sid)
    if staff is None:
        raise HTTPException(status_code=401, detail="Unknown staff id")
    if (staff.role or "").strip().lower() != "manager":
        raise HTTPException(status_code=403, detail="Manager role required")
    return staff
