"""Konversi generik model <-> dict JSON, mengikuti kontrak tipe frontend."""
import datetime as dt
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, inspect
from sqlalchemy.orm import DeclarativeBase

from .security import hash_password

HIDDEN = {"password_hash"}


def to_dict(obj: DeclarativeBase) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in inspect(obj).mapper.column_attrs:
        if col.key in HIDDEN:
            continue
        v = getattr(obj, col.key)
        if isinstance(v, (dt.date, dt.datetime)):
            v = v.isoformat()
        out[col.key] = v
    return out


def _coerce(column, value: Any) -> Any:
    if value is None or value == "":
        return None if column.nullable or value is None else value
    col_type = column.type
    if isinstance(col_type, DateTime) and isinstance(value, str):
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    if isinstance(col_type, Date) and isinstance(value, str):
        return dt.date.fromisoformat(value[:10])
    return value


def coerce_query(column, value: str) -> Any:
    """Konversi nilai query string (?kolom=nilai) ke tipe kolom."""
    t = column.type
    try:
        if isinstance(t, Boolean):
            return value.lower() in ("1", "true", "yes")
        if isinstance(t, Integer):
            return int(value)
        if isinstance(t, Float):
            return float(value)
    except ValueError:
        raise HTTPException(422, f"Nilai filter '{column.key}' tidak valid")
    return _coerce(column, value)


def apply_payload(obj: DeclarativeBase, data: dict[str, Any], *, partial: bool) -> DeclarativeBase:
    """Salin field yang dikenal dari payload ke objek model (abaikan field asing)."""
    mapper = inspect(type(obj))
    columns = {c.key: c.columns[0] for c in mapper.column_attrs}
    for key, value in data.items():
        if key == "id":
            continue
        if key == "password" and "password_hash" in columns:
            if value:
                obj.password_hash = hash_password(value)  # type: ignore[attr-defined]
            continue
        if key not in columns or key in HIDDEN:
            continue
        try:
            setattr(obj, key, _coerce(columns[key], value))
        except ValueError as e:
            raise HTTPException(422, f"Format tidak valid untuk '{key}': {e}")
    if not partial:
        missing = [k for k, c in columns.items() if not c.nullable and c.default is None and not c.primary_key and getattr(obj, k) is None and k not in HIDDEN]
        if missing:
            raise HTTPException(422, f"Field wajib belum diisi: {', '.join(missing)}")
    return obj
