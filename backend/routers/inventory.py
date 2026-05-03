from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..inventory_stock import apply_stock_delta
from ..schemas import InventoryOut, InventoryRestock

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryOut])
def list_inventory(shop_id: int, db: Session = Depends(get_db)):
    """Stock rows for a shop, joined to product name for the UI."""
    sql = text("""
        SELECT
            i.id,
            i.shop_id,
            i.product_id,
            i.stock_level,
            i.last_restock_date,
            p.product_name,
            p.unit_measure
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE i.shop_id = :shop_id
        ORDER BY p.product_name
    """)
    rows = db.execute(sql, {"shop_id": shop_id}).mappings().all()
    return [InventoryOut(**row) for row in rows]


@router.post("/restock", response_model=InventoryOut, status_code=200)
def restock(payload: InventoryRestock, db: Session = Depends(get_db)):
    """Increase stock and set ``last_restock_date`` (receiving / stocktake adjustment)."""
    try:
        apply_stock_delta(
            db,
            payload.shop_id,
            payload.product_id,
            payload.quantity,
            set_restock_time=True,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Database constraint violation: {exc.orig}",
        ) from exc

    row = (
        db.execute(
            text("""
                SELECT
                    i.id,
                    i.shop_id,
                    i.product_id,
                    i.stock_level,
                    i.last_restock_date,
                    p.product_name,
                    p.unit_measure
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.shop_id = :shop_id AND i.product_id = :product_id
            """),
            {"shop_id": payload.shop_id, "product_id": payload.product_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=500, detail="Inventory row missing after restock")
    return InventoryOut(**row)
