"""Pydantic v2 schemas for request validation and response serialisation."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PaymentMethod(str, Enum):
    CASH = "Cash"
    CARD = "Card"
    EFTPOS = "EFTPOS"


class WastageReason(str, Enum):
    EXPIRED = "Expired"
    FRIDGE_FAILURE = "Fridge Failure"
    SPOILED = "Spoiled"
    DAMAGED = "Damaged"
    CROSS_CONTAMINATION = "Cross-Contamination"
    CUTTING_ERROR = "Cutting Error"
    OTHER = "Other"


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ShopBase(BaseModel):
    shop_name: str
    location: Optional[str] = None
    shop_code: str


class ShopCreate(ShopBase):
    pass


class ShopUpdate(BaseModel):
    shop_name: Optional[str] = None
    location: Optional[str] = None
    shop_code: Optional[str] = None


class ShopOut(ShopBase, ORMModel):
    id: int


class StaffBase(BaseModel):
    staff_name: str
    role: Optional[str] = None
    shop_id: int


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    staff_name: Optional[str] = None
    role: Optional[str] = None
    shop_id: Optional[int] = None


class StaffOut(StaffBase, ORMModel):
    id: int


class CategoryBase(BaseModel):
    name: str


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None


class CategoryOut(CategoryBase, ORMModel):
    id: int


class SupplierBase(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None


class SupplierOut(SupplierBase, ORMModel):
    id: int


class CustomerBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    loyalty_tier: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    loyalty_tier: Optional[str] = None


class CustomerOut(CustomerBase, ORMModel):
    id: int


class PromotionBase(BaseModel):
    # Warehouse: promo_name and discount_percent may be NULL on legacy rows.
    promo_name: Optional[str] = None
    discount_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    is_active: bool = True


class PromotionCreate(BaseModel):
    """Create payload: sensible defaults match warehouse DEFAULTs."""

    promo_name: Optional[str] = None
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    is_active: bool = True


class PromotionUpdate(BaseModel):
    promo_name: Optional[str] = None
    discount_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    is_active: Optional[bool] = None


class PromotionOut(PromotionBase, ORMModel):
    id: int


class ProductBase(BaseModel):
    product_name: str
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    unit_price: Decimal = Field(ge=0)
    # Aligns with warehouse NOT NULL; sends 0 when omitted.
    cost_price: Decimal = Field(default=Decimal("0"), ge=0)
    unit_measure: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    cost_price: Optional[Decimal] = Field(default=None, ge=0)
    unit_measure: Optional[str] = None


class ProductOut(ProductBase, ORMModel):
    id: int
    category_name: Optional[str] = None
    supplier_name: Optional[str] = None


class SaleItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)
    price_at_sale: Decimal = Field(ge=0)
    discount_applied: Decimal = Field(default=Decimal("0"), ge=0)


class SaleItemOut(SaleItemIn, ORMModel):
    id: int
    sale_id: int


class SaleCreate(BaseModel):
    shop_id: int = Field(gt=0)
    staff_id: int = Field(gt=0)
    customer_id: Optional[int] = None
    promo_id: Optional[int] = None
    payment_method: PaymentMethod
    items: List[SaleItemIn] = Field(min_length=1)


class SaleOut(ORMModel):
    id: int
    shop_id: int
    staff_id: int
    customer_id: Optional[int] = None
    promo_id: Optional[int] = None
    payment_method: str
    total_amount: Decimal
    created_at: Optional[datetime] = None
    items: List[SaleItemOut] = []


class WastageCreate(BaseModel):
    shop_id: int = Field(gt=0)
    product_id: int = Field(gt=0)
    staff_id: int = Field(gt=0)
    quantity_wasted: Decimal = Field(gt=0)
    reason: WastageReason


class WastageOut(ORMModel):
    id: int
    shop_id: int
    product_id: int
    staff_id: int
    quantity_wasted: Decimal
    reason: str
    created_at: Optional[datetime] = None


class InventoryOut(ORMModel):
    id: int
    shop_id: int
    product_id: int
    stock_level: Optional[Decimal] = None
    last_restock_date: Optional[datetime] = None
    product_name: Optional[str] = None
    unit_measure: Optional[str] = None


class InventoryRestock(BaseModel):
    shop_id: int = Field(gt=0)
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0)
