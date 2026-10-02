"""Instalasi bersih untuk SMP Negeri 3 Pandak, Bantul (tanpa data contoh).

Membuat tabel lalu mengisi data master minimum: profil sekolah, unit SMP, tahun ajaran,
mata pelajaran Kurikulum Merdeka SMP (+ Bahasa Jawa, muatan lokal DIY), dan satu akun admin.
Data siswa, guru, kelas, dan biaya diisi sekolah lewat aplikasi (menu Impor / Pengaturan).

Pemakaian:
    ADMIN_PASSWORD='...' python -m app.setup_school
Hanya berjalan bila database belum berisi pengguna (tidak menimpa data yang ada).
"""
import os
import secrets
import sys

from sqlalchemy import insert, select, text

from .database import Base, SessionLocal, engine
from .models import RESOURCES, User
from .security import hash_password
from .seed import coerce_row

SCHOOL = "SMP Negeri 3 Pandak"
ADDRESS = "Pandak, Kabupaten Bantul, Daerah Istimewa Yogyakarta"

SUBJECTS = [
    ("PAI", "Pendidikan Agama dan Budi Pekerti", "Umum"), ("PP", "Pendidikan Pancasila", "Umum"),
    ("BIN", "Bahasa Indonesia", "Umum"), ("MTK", "Matematika", "Umum"), ("IPA", "Ilmu Pengetahuan Alam", "Umum"),
    ("IPS", "Ilmu Pengetahuan Sosial", "Umum"), ("BIG", "Bahasa Inggris", "Umum"),
    ("PJOK", "Pendidikan Jasmani, Olahraga, dan Kesehatan", "Umum"), ("INF", "Informatika", "Umum"),
    ("SB", "Seni Budaya", "Umum"), ("BJW", "Bahasa Jawa", "Muatan Lokal"),
]


def master_data() -> dict:
    return {
        "settings": [{
            "id": 1, "name": SCHOOL, "foundation": "Pemerintah Kabupaten Bantul", "address": ADDRESS,
            "phone": "", "email": "", "website": "", "vision": "", "mission": "",
            "ppdb_open": False, "library_loan_days": 7, "library_max_loans": 3, "library_fine_per_day": 500,
            "bank_name": "", "bank_account": "", "bank_holder": "",
        }],
        "units": [{"id": 1, "code": "SMP", "name": SCHOOL, "npsn": "", "accreditation": "", "address": ADDRESS,
                   "head_id": None, "min_grade": 7, "max_grade": 9}],
        "academic_years": [
            {"id": 1, "name": "2026/2027", "semester": "Ganjil", "start_date": "2026-07-13", "end_date": "2026-12-19", "is_active": True},
            {"id": 2, "name": "2026/2027", "semester": "Genap", "start_date": "2027-01-04", "end_date": "2027-06-26", "is_active": False},
        ],
        "subjects": [{"id": i + 1, "unit_id": 1, "code": c, "name": n, "group": g, "kkm": 75} for i, (c, n, g) in enumerate(SUBJECTS)],
    }


def setup(admin_password: str) -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalars(select(User)).first():
            sys.exit("Database sudah berisi pengguna — instalasi dibatalkan agar data tidak tertimpa.")
        data = master_data()
        data["users"] = [{"id": 1, "username": "admin", "password_hash": hash_password(admin_password), "name": "Administrator",
                          "role": "admin", "employee_id": None, "student_id": None, "guardian_id": None, "is_active": True}]
        for name, model in RESOURCES.items():
            if data.get(name):
                db.execute(insert(model), [coerce_row(model, r) for r in data[name]])
                print(f"  {name:<16} {len(data[name]):>3} baris")
        db.commit()
        if engine.dialect.name == "postgresql":
            for name in RESOURCES:
                db.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT MAX(id) FROM {name}), 1))"))
            db.commit()
    print(f"Instalasi {SCHOOL} selesai. Login: admin")


if __name__ == "__main__":
    pw = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
    if len(pw) < 10:
        sys.exit("ADMIN_PASSWORD minimal 10 karakter")
    setup(pw)
    if not os.environ.get("ADMIN_PASSWORD"):
        print(f"Password admin (simpan & segera ganti): {pw}")
