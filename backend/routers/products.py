from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


_BASE_SQL = """
    SELECT
        p.id,
        p.product_name,
        p.category_id,
        p.supplier_id,
        p.unit_price,
        p.cost_price,
        p.unit_measure,
        c.name AS category_name,
        s.company_name AS supplier_name
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    LEFT JOIN suppliers s ON s.id = p.supplier_id
"""


@router.get("", response_model=list[ProductOut])
def list_products(category_id: int | None = None, db: Session = Depends(get_db)):
    # Build the WHERE clause conditionally - pg8000 can't infer the type of a
    # NULL parameter used only in an IS NULL check, so we just omit the clause
    # entirely when no filter is supplied.
    sql = _BASE_SQL
    params: dict = {}
    if category_id is not None:
        sql += " WHERE p.category_id = :category_id"
        params["category_id"] = category_id
    sql += " ORDER BY p.product_name"
    rows = db.execute(text(sql), params).mappings().all()
    return [ProductOut(**row) for row in rows]


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return _serialise(product, db)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "cost_price" and value is None:
            continue
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return _serialise(product, db)


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()


def _serialise(product: Product, db: Session) -> ProductOut:
    return ProductOut(
        id=product.id,
        product_name=product.product_name,
        category_id=product.category_id,
        supplier_id=product.supplier_id,
        unit_price=product.unit_price,
        cost_price=product.cost_price,
        unit_measure=product.unit_measure,
        category_name=product.category.name if product.category else None,
        supplier_name=product.supplier.company_name if product.supplier else None,
    )
