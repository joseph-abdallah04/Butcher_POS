from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_manager
from ..models import Promotion, ShopStaff
from ..schemas import PromotionCreate, PromotionOut, PromotionUpdate

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("", response_model=list[PromotionOut])
def list_promotions(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Promotion)
    if active_only:
        query = query.filter(Promotion.is_active.is_(True))
    return query.order_by(Promotion.promo_name.asc().nulls_last()).all()


@router.post("", response_model=PromotionOut, status_code=201)
def create_promotion(
    payload: PromotionCreate,
    db: Session = Depends(get_db),
    _: ShopStaff = Depends(require_manager),
):
    promo = Promotion(**payload.model_dump())
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.put("/{promo_id}", response_model=PromotionOut)
def update_promotion(
    promo_id: int,
    payload: PromotionUpdate,
    db: Session = Depends(get_db),
    _: ShopStaff = Depends(require_manager),
):
    promo = db.get(Promotion, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(promo, key, value)
    db.commit()
    db.refresh(promo)
    return promo


@router.delete("/{promo_id}", status_code=204)
def delete_promotion(
    promo_id: int,
    db: Session = Depends(get_db),
    _: ShopStaff = Depends(require_manager),
):
    promo = db.get(Promotion, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    db.delete(promo)
    db.commit()
