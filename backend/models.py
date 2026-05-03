"""SQLAlchemy ORM models mirroring the enterprise Postgres warehouse schema.

**DDL** = the SQL that defines your tables (``CREATE TABLE …``): columns, types,
whether a column can be NULL, defaults, and foreign keys. These models are kept in
step with that schema so reads/writes match Cloud SQL.

Tables covered: ``shops``, ``shop_staff``, ``product_categories``, ``suppliers``,
``customers``, ``promotions``, ``products``, ``sales``, ``sale_items`` (FK to
``sales`` with ON DELETE CASCADE), ``inventory``, ``wastage`` (includes ``staff_id``).

We do not run ``Base.metadata.create_all`` — tables already exist.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.orm import relationship

from .database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String(100), nullable=False)
    location = Column(String(100))
    shop_code = Column(String(10), unique=True, nullable=False)

    staff = relationship("ShopStaff", back_populates="shop", cascade="all, delete-orphan")


class ShopStaff(Base):
    __tablename__ = "shop_staff"

    id = Column(Integer, primary_key=True, index=True)
    staff_name = Column(String(100), nullable=False)
    role = Column(String(50))
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    shop = relationship("Shop", back_populates="staff")


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(100), nullable=False)
    contact_person = Column(String(100))
    email = Column(String(100))


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50))
    last_name = Column(String(50))
    email = Column(String(100), unique=True)
    loyalty_tier = Column(String(20), server_default=text("'Standard'"))


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    promo_name = Column(String(100))
    discount_percent = Column(Numeric(5, 2), server_default=text("0"))
    is_active = Column(Boolean, nullable=False, server_default=text("true"))


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(100), nullable=False)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(10, 2), nullable=False, server_default=text("0"))
    unit_measure = Column(String(10), server_default=text("'kg'"))

    category = relationship("ProductCategory")
    supplier = relationship("Supplier")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("shop_staff.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    promo_id = Column(Integer, ForeignKey("promotions.id"))
    payment_method = Column(String(20), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(
        Integer,
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    price_at_sale = Column(Numeric(10, 2), nullable=False)
    discount_applied = Column(Numeric(10, 2), nullable=False, server_default=text("0"))

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    stock_level = Column(Numeric(10, 3))
    last_restock_date = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop")
    product = relationship("Product")


class Wastage(Base):
    __tablename__ = "wastage"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("shop_staff.id"), nullable=False)
    quantity_wasted = Column(Numeric(10, 3), nullable=False)
    reason = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
