from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from decimal import Decimal

from ..database import get_db
from ..inventory_stock import InsufficientStock, apply_stock_delta, assert_sufficient_stock
from ..models import ShopStaff, Wastage
from ..schemas import WastageCreate, WastageOut

router = APIRouter(prefix="/wastage", tags=["wastage"])


@router.get("", response_model=list[WastageOut])
def list_wastage(
    shop_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Wastage)
    if shop_id is not None:
        query = query.filter(Wastage.shop_id == shop_id)
    return query.order_by(Wastage.created_at.desc()).limit(limit).all()


@router.post("", response_model=WastageOut, status_code=201)
def create_wastage(payload: WastageCreate, db: Session = Depends(get_db)):
    staff_row = db.get(ShopStaff, payload.staff_id)
    if staff_row is None or staff_row.shop_id != payload.shop_id:
        raise HTTPException(
            status_code=400,
            detail="staff_id does not belong to the given shop_id",
        )

    waste = Wastage(
        shop_id=payload.shop_id,
        product_id=payload.product_id,
        staff_id=payload.staff_id,
        quantity_wasted=payload.quantity_wasted,
        reason=payload.reason.value,
    )
    try:
        assert_sufficient_stock(
            db,
            payload.shop_id,
            payload.product_id,
            Decimal(payload.quantity_wasted),
        )
        db.add(waste)
        apply_stock_delta(
            db,
            payload.shop_id,
            payload.product_id,
            -Decimal(payload.quantity_wasted),
        )
        db.commit()
    except InsufficientStock as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Database constraint violation: {exc.orig}",
        ) from exc
    db.refresh(waste)
    return waste
