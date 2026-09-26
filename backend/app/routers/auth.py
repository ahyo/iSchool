from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Principal, get_principal
from ..models import User
from ..security import create_access_token, hash_password, verify_password
from ..serialize import to_dict

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(func.lower(User.username) == body.username.strip().lower())).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Username atau password salah")
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer", "user": to_dict(user)}


@router.get("/me")
def me(p: Principal = Depends(get_principal)):
    return {**to_dict(p.user), "student_ids": sorted(p.student_ids)}


@router.post("/change-password")
def change_password(body: ChangePasswordIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = db.get(User, p.user.id)
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(400, "Password lama salah")
    if len(body.new_password) < 6:
        raise HTTPException(422, "Password baru minimal 6 karakter")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
