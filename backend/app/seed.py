"""Membuat tabel dan mengisi data contoh (identik dengan mode demo frontend).

Pemakaian:
    python -m app.seed            # buat tabel & isi jika database masih kosong
    python -m app.seed --reset    # hapus semua tabel lalu isi ulang

Sumber data: app/seed_data.json (dibuat dengan `npm run export-seed` di folder frontend).
"""
import json
import sys
from pathlib import Path

from sqlalchemy import inspect, insert, select, text

from .database import Base, SessionLocal, engine
from .models import RESOURCES, User
from .security import hash_password
from .serialize import _coerce

SEED_FILE = Path(__file__).with_name("seed_data.json")


def coerce_row(model, row: dict) -> dict:
    columns = {c.key: c.columns[0] for c in inspect(model).mapper.column_attrs}
    out = {}
    for k, v in row.items():
        if k in columns:
            out[k] = _coerce(columns[k], v) if v is not None else None
    return out


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalars(select(User)).first():
            print("Database sudah berisi data. Gunakan --reset untuk mengisi ulang.")
            return
        data = json.loads(SEED_FILE.read_text())
        hashed: dict[str, str] = {}
        for name, model in RESOURCES.items():
            rows = data.get(name) or []
            if not rows:
                continue
            if name == "users":  # hash sekali per password unik (bcrypt lambat)
                for r in rows:
                    pw = r.pop("password")
                    hashed.setdefault(pw, hash_password(pw))
                    r["password_hash"] = hashed[pw]
            db.execute(insert(model), [coerce_row(model, r) for r in rows])
            print(f"  {name:<22} {len(rows):>5} baris")
        db.commit()
        # Sinkronkan sequence id PostgreSQL setelah insert dengan id eksplisit
        if engine.dialect.name == "postgresql":
            for name in RESOURCES:
                db.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT MAX(id) FROM {name}), 1))"))
            db.commit()
    print("Seed selesai. Login: admin / demo123 (juga kepsek, keuangan, kesiswaan, guru, siswa, ortu)")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
