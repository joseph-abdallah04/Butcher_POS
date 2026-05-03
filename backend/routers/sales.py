"""Sales endpoint with a single Postgres transaction wrapping the parent
``sales`` row and all child ``sale_items`` rows."""

from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..inventory_stock import InsufficientStock, apply_stock_delta, assert_sufficient_stock
from ..models import Sale, SaleItem, ShopStaff
from ..schemas import SaleCreate, SaleOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[SaleOut])
def list_sales(
    shop_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Sale).options(selectinload(Sale.items))
    if shop_id is not None:
        query = query.filter(Sale.shop_id == shop_id)
    return query.order_by(Sale.created_at.desc()).limit(limit).all()


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    staff_row = db.get(ShopStaff, payload.staff_id)
    if staff_row is None or staff_row.shop_id != payload.shop_id:
        raise HTTPException(
            status_code=400,
            detail="staff_id does not belong to the given shop_id",
        )

    total = sum(
        (item.quantity * item.price_at_sale) - item.discount_applied
        for item in payload.items
    )
    if total < 0:
        raise HTTPException(status_code=400, detail="Total amount cannot be negative")

    sale = Sale(
        shop_id=payload.shop_id,
        staff_id=payload.staff_id,
        customer_id=payload.customer_id,
        promo_id=payload.promo_id,
        payment_method=payload.payment_method.value,
        total_amount=Decimal(total),
    )
    totals: defaultdict[int, Decimal] = defaultdict(Decimal)
    for item in payload.items:
        totals[item.product_id] += Decimal(item.quantity)

    try:
        for product_id, qty in totals.items():
            assert_sufficient_stock(db, payload.shop_id, product_id, qty)

        db.add(sale)
        db.flush()
        db.add_all(
            [
                SaleItem(
                    sale_id=sale.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    price_at_sale=item.price_at_sale,
                    discount_applied=item.discount_applied,
                )
                for item in payload.items
            ]
        )
        for item in payload.items:
            apply_stock_delta(
                db,
                payload.shop_id,
                item.product_id,
                -Decimal(item.quantity),
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

    db.refresh(sale)
    _ = sale.items
    return sale
