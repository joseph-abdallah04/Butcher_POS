from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Shop, ShopStaff
from ..schemas import ShopCreate, ShopOut, ShopUpdate, StaffOut

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("", response_model=list[ShopOut])
def list_shops(db: Session = Depends(get_db)):
    return db.query(Shop).order_by(Shop.shop_name).all()


@router.post("", response_model=ShopOut, status_code=201)
def create_shop(payload: ShopCreate, db: Session = Depends(get_db)):
    shop = Shop(**payload.model_dump())
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop


@router.get("/{shop_id}", response_model=ShopOut)
def get_shop(shop_id: int, db: Session = Depends(get_db)):
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.put("/{shop_id}", response_model=ShopOut)
def update_shop(shop_id: int, payload: ShopUpdate, db: Session = Depends(get_db)):
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(shop, key, value)
    db.commit()
    db.refresh(shop)
    return shop


@router.delete("/{shop_id}", status_code=204)
def delete_shop(shop_id: int, db: Session = Depends(get_db)):
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    db.delete(shop)
    db.commit()


@router.get("/{shop_id}/staff", response_model=list[StaffOut])
def list_staff_for_shop(shop_id: int, db: Session = Depends(get_db)):
    return (
        db.query(ShopStaff)
        .filter(ShopStaff.shop_id == shop_id)
        .order_by(ShopStaff.staff_name)
        .all()
    )
