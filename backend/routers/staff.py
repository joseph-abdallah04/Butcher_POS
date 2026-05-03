from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ShopStaff
from ..schemas import StaffCreate, StaffOut, StaffUpdate

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=list[StaffOut])
def list_staff(shop_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(ShopStaff)
    if shop_id is not None:
        query = query.filter(ShopStaff.shop_id == shop_id)
    return query.order_by(ShopStaff.staff_name).all()


@router.post("", response_model=StaffOut, status_code=201)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    staff = ShopStaff(**payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.get(ShopStaff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff


@router.put("/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: int, payload: StaffUpdate, db: Session = Depends(get_db)):
    staff = db.get(ShopStaff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(staff, key, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.get(ShopStaff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(staff)
    db.commit()
