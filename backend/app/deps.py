from collections.abc import Callable
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Student, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)

STAFF = {"admin", "kepsek", "keuangan", "kesiswaan"}


@dataclass
class Principal:
    """User login beserta daftar siswa yang boleh diakses (untuk siswa & orang tua)."""

    user: User
    student_ids: set[int] = field(default_factory=set)

    @property
    def role(self) -> str:
        return self.user.role

    @property
    def is_family(self) -> bool:
        return self.role in ("siswa", "ortu")


def get_principal(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> Principal:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Silakan login terlebih dahulu")
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesi tidak valid atau kedaluwarsa")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Akun tidak aktif")
    ids: set[int] = set()
    if user.role == "siswa" and user.student_id:
        ids = {user.student_id}
    elif user.role == "ortu" and user.guardian_id:
        ids = set(db.scalars(select(Student.id).where(Student.guardian_id == user.guardian_id)))
    return Principal(user=user, student_ids=ids)


def require_roles(*roles: str) -> Callable[[Principal], Principal]:
    def checker(p: Principal = Depends(get_principal)) -> Principal:
        if p.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda tidak memiliki akses untuk tindakan ini")
        return p

    return checker


def ensure_role(p: Principal, *roles: str) -> None:
    if p.role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda tidak memiliki akses untuk tindakan ini")
