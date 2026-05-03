"""Per-shop product stock: apply deltas in the same transaction as sales / wastage."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from .models import Inventory, Product

_ZERO = Decimal("0")


def _coerce_level(value) -> Decimal:
    if value is None:
        return _ZERO
    return Decimal(value)


class InsufficientStock(Exception):
    """Raised when a sale or wastage would drop ``stock_level`` below zero."""

    def __init__(
        self,
        *,
        product_id: int,
        on_hand: Decimal,
        requested: Decimal,
        product_name: str | None = None,
    ) -> None:
        self.product_id = product_id
        self.on_hand = on_hand
        self.requested = requested
        self.product_name = product_name
        label = product_name or f"product #{product_id}"
        super().__init__(
            f"Insufficient stock for {label}: on hand {on_hand}, requested {requested}."
        )


def assert_sufficient_stock(
    db: Session,
    shop_id: int,
    product_id: int,
    quantity: Decimal,
) -> None:
    """Lock the inventory row (if any) and ensure ``quantity`` can be removed without going negative.

    Missing inventory row is treated as zero on hand. Call in the same transaction as the sale/wastage,
    before applying negative deltas.
    """
    q = Decimal(quantity)
    if q <= _ZERO:
        return
    inv = (
        db.query(Inventory)
        .filter(Inventory.shop_id == shop_id, Inventory.product_id == product_id)
        .with_for_update()
        .first()
    )
    on_hand = _coerce_level(inv.stock_level if inv else None)
    if on_hand < q:
        p = db.get(Product, product_id)
        raise InsufficientStock(
            product_id=product_id,
            on_hand=on_hand,
            requested=q,
            product_name=p.product_name if p else None,
        )


def apply_stock_delta(
    db: Session,
    shop_id: int,
    product_id: int,
    delta: Decimal,
    *,
    set_restock_time: bool = False,
) -> None:
    """Adjust ``stock_level`` for one (shop, product) row. Creates a row only for positive deltas.

    Negative deltas never create a new row (cannot sell/waste stock that was never recorded).
    ``assert_sufficient_stock`` should run first for removals; this function still guards negatives.
    """
    delta = Decimal(delta)
    inv = (
        db.query(Inventory)
        .filter(Inventory.shop_id == shop_id, Inventory.product_id == product_id)
        .with_for_update()
        .first()
    )
    if inv is None:
        if delta < _ZERO:
            p = db.get(Product, product_id)
            raise InsufficientStock(
                product_id=product_id,
                on_hand=_ZERO,
                requested=-delta,
                product_name=p.product_name if p else None,
            )
        inv = Inventory(
            shop_id=shop_id,
            product_id=product_id,
            stock_level=delta,
        )
        db.add(inv)
    else:
        prev = _coerce_level(inv.stock_level)
        new_level = prev + delta
        if new_level < _ZERO:
            p = db.get(Product, product_id)
            raise InsufficientStock(
                product_id=product_id,
                on_hand=prev,
                requested=-delta,
                product_name=p.product_name if p else None,
            )
        inv.stock_level = new_level
    if set_restock_time:
        inv.last_restock_date = datetime.now(timezone.utc)
