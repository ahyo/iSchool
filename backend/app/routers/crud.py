"""Router REST generik: GET/POST /api/{resource}, GET/PATCH/DELETE /api/{resource}/{id}.

Hak akses:
  * READ  : semua user login; siswa/orang tua hanya melihat data miliknya (row-level scoping).
  * WRITE : sesuai tabel WRITE_ROLES.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Principal, get_principal
from ..models import RESOURCES, EmployeeAttendance, Guardian, Student, User
from ..serialize import apply_payload, coerce_query, to_dict

router = APIRouter(prefix="/api", tags=["data"])

ADMIN = {"admin"}
WRITE_ROLES: dict[str, set[str]] = {
    "settings": ADMIN, "units": ADMIN, "academic_years": ADMIN, "majors": ADMIN, "users": ADMIN,
    "subjects": ADMIN, "classes": ADMIN, "schedules": ADMIN, "employees": ADMIN, "employee_attendance": ADMIN,
    "students": {"admin", "kesiswaan"}, "guardians": {"admin", "kesiswaan"}, "applicants": {"admin", "kesiswaan"},
    "student_attendance": {"admin", "kesiswaan", "guru"},
    "materials": {"admin", "guru"}, "assignments": {"admin", "guru"}, "exams": {"admin", "guru"},
    "submissions": {"admin", "guru"}, "exam_results": {"admin", "guru"}, "grades": {"admin", "guru"},
    "fee_types": {"admin", "keuangan"}, "bills": {"admin", "keuangan"}, "payments": {"admin", "keuangan"},
    "announcements": {"admin", "kepsek", "kesiswaan", "keuangan"}, "events": {"admin", "kepsek", "kesiswaan", "keuangan"},
    "student_records": {"admin", "kesiswaan", "guru"}, "promotions": {"admin", "kepsek", "kesiswaan"},
    "extracurriculars": {"admin", "kesiswaan"},
    # E-learning: konten oleh guru; progres & diskusi hanya lewat aksi (/api/actions)
    "lessons": {"admin", "guru"}, "virtual_classes": {"admin", "guru"},
    "lesson_progress": ADMIN, "discussions": ADMIN,
    "enrollments": ADMIN,  # diisi lewat aksi arsip / kenaikan kelas
    "expenses": {"admin", "keuangan"}, "teaching_journals": {"admin", "guru"},
    "leave_requests": ADMIN,  # lewat aksi leave.submit / leave.review
    "books": {"admin", "pustakawan"},
    "book_loans": ADMIN, "book_reservations": ADMIN,  # lewat aksi library.*
}
# Data yang tidak boleh dilihat siswa/orang tua sama sekali
STAFF_ONLY_READ = {"applicants", "teaching_journals"}
# Data keuangan internal hanya untuk peran berikut
FINANCE_READ = {"admin", "keuangan", "kepsek"}
# Guru hanya boleh menulis baris miliknya (kolom pemilik)
OWNER_FIELD = {"teaching_journals": "teacher_id"}


def _model(resource: str):
    model = RESOURCES.get(resource)
    if not model:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Resource '{resource}' tidak dikenal")
    return model


def scope_query(stmt, model, p: Principal):
    """Batasi baris yang boleh dibaca sesuai peran."""
    resource = model.__tablename__
    cols = {c.key for c in inspect(model).mapper.column_attrs}
    if resource == "users" and p.role != "admin":
        return stmt.where(User.id == p.user.id)
    if resource in ("book_loans", "book_reservations") and not p.is_family and p.role not in ("admin", "pustakawan", "kepsek"):
        # Guru/staf lain hanya melihat pinjaman miliknya sendiri
        return stmt.where(getattr(model, "employee_id") == (p.user.employee_id or -1))
    if resource == "expenses" and p.role not in FINANCE_READ:
        return stmt.where(False)
    if resource == "employee_attendance" and p.role not in ("admin", "kepsek"):
        return stmt.where(EmployeeAttendance.employee_id == (p.user.employee_id or -1))
    if not p.is_family:
        return stmt
    if resource in STAFF_ONLY_READ:
        return stmt.where(False)
    if resource == "lessons":
        return stmt.where(model.is_published.is_(True))
    ids = p.student_ids or {-1}
    if resource == "students":
        return stmt.where(Student.id.in_(ids))
    if resource == "guardians":
        return stmt.where(Guardian.id.in_(select(Student.guardian_id).where(Student.id.in_(ids))))
    if "student_id" in cols:
        return stmt.where(getattr(model, "student_id").in_(ids))
    return stmt


def serialize(obj, p: Principal) -> dict[str, Any]:
    d = to_dict(obj)
    # Kunci jawaban ujian tidak dikirim ke siswa / orang tua
    if p.is_family and obj.__tablename__ == "exams":
        d["questions"] = [{"q": q.get("q"), "options": q.get("options"), "answer": -1} for q in d.get("questions") or []]
    if p.is_family and obj.__tablename__ == "lessons":
        d["quiz"] = [{"q": q.get("q"), "options": q.get("options"), "answer": -1} for q in d.get("quiz") or []]
    return d


def ensure_write(resource: str, p: Principal) -> None:
    if p.role not in WRITE_ROLES.get(resource, ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda tidak memiliki akses untuk mengubah data ini")


def ensure_owner(resource: str, obj, p: Principal) -> None:
    field = OWNER_FIELD.get(resource)
    if field and p.role == "guru" and getattr(obj, field) != p.user.employee_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda hanya dapat mengubah data milik sendiri")


@router.get("/{resource}")
def list_rows(resource: str, request: Request, db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    model = _model(resource)
    stmt = scope_query(select(model), model, p)
    columns = {c.key: c.columns[0] for c in inspect(model).mapper.column_attrs}
    for key, value in request.query_params.items():
        if key in columns and key != "password_hash":
            stmt = stmt.where(getattr(model, key) == coerce_query(columns[key], value))
    stmt = stmt.order_by(model.id)
    return [serialize(o, p) for o in db.scalars(stmt)]


@router.get("/{resource}/{item_id}")
def get_row(resource: str, item_id: int, db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    model = _model(resource)
    obj = db.scalars(scope_query(select(model).where(model.id == item_id), model, p)).first()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Data tidak ditemukan")
    return serialize(obj, p)


@router.post("/{resource}", status_code=201)
def create_row(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    model = _model(resource)
    ensure_write(resource, p)
    if model is User and not payload.get("password"):
        raise HTTPException(422, "Password wajib diisi")
    if p.role == "guru" and resource in OWNER_FIELD:
        payload = {**payload, OWNER_FIELD[resource]: p.user.employee_id}
    obj = apply_payload(model(), payload, partial=False)
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(409, f"Data bentrok / duplikat: {e.orig}")
    db.refresh(obj)
    return serialize(obj, p)


@router.patch("/{resource}/{item_id}")
def update_row(resource: str, item_id: int, payload: dict[str, Any], db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    model = _model(resource)
    ensure_write(resource, p)
    obj = db.get(model, item_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Data tidak ditemukan")
    ensure_owner(resource, obj, p)
    payload = {k: v for k, v in payload.items() if not (p.role == "guru" and k == OWNER_FIELD.get(resource))}
    apply_payload(obj, payload, partial=True)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(409, f"Data bentrok / duplikat: {e.orig}")
    db.refresh(obj)
    return serialize(obj, p)


@router.delete("/{resource}/{item_id}", status_code=204)
def delete_row(resource: str, item_id: int, db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    model = _model(resource)
    ensure_write(resource, p)
    obj = db.get(model, item_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Data tidak ditemukan")
    ensure_owner(resource, obj, p)
    db.delete(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Data masih dipakai oleh data lain sehingga tidak dapat dihapus")
