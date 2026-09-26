"""Impor data massal (siswa, pegawai, riwayat kelas, nilai rapor).

Padanan dari frontend/src/lib/demo/importer.ts. Setiap baris divalidasi terpisah;
baris yang error dilewati. `dry_run=True` hanya memvalidasi tanpa menyimpan.
"""
import datetime as dt
import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AcademicYear, Book, BookLoan, Employee, Enrollment, Grade, Guardian, SchoolClass, Student, Subject, Unit, User
from .security import hash_password

DEFAULT_PASSWORD = "demo123"


def s(v: Any) -> str:
    return "" if v is None else str(v).strip()


def parse_date(v: Any) -> dt.date | None | bool:
    """None = kosong, False = format tidak valid."""
    t = s(v)
    if not t:
        return None
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", t)
    try:
        if m:
            return dt.date(int(m[1]), int(m[2]), int(m[3]))
        m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", t)
        if m:
            return dt.date(int(m[3]), int(m[2]), int(m[1]))
    except ValueError:
        return False
    return False


def parse_score(v: Any, label: str, errors: list[str]) -> float | None:
    t = s(v).replace(",", ".")
    if not t:
        return None
    try:
        n = float(t)
    except ValueError:
        n = -1
    if not 0 <= n <= 100:
        errors.append(f"{label} harus angka 0–100")
        return None
    return n


def parse_count(v: Any, label: str, errors: list[str]) -> int:
    t = s(v)
    if not t:
        return 0
    try:
        n = int(float(t))
        if n < 0 or float(t) != n:
            raise ValueError
        return n
    except ValueError:
        errors.append(f"{label} harus bilangan bulat ≥ 0")
        return 0


def compute_final(g: dict) -> float | None:
    parts = [(g.get("assignment"), 0.3), (g.get("daily"), 0.2), (g.get("midterm"), 0.2), (g.get("final_exam"), 0.3)]
    present = [(v, w) for v, w in parts if isinstance(v, (int, float))]
    if not present:
        return None
    return round(sum(v * w for v, w in present) / sum(w for _, w in present), 1)


def validate_year(r: dict, errors: list[str]) -> tuple[str, str]:
    name = re.sub(r"\s", "", s(r.get("tahun_ajaran")))
    semester = s(r.get("semester")).capitalize()
    if not re.match(r"^\d{4}/\d{4}$", name) or int(name[5:]) != int(name[:4]) + 1:
        errors.append("Tahun ajaran harus berformat 2024/2025")
    if semester not in ("Ganjil", "Genap"):
        errors.append("Semester harus Ganjil atau Genap")
    return name, semester


def find_year(db: Session, name: str, semester: str, create: bool) -> AcademicYear | None:
    y = db.scalars(select(AcademicYear).where(AcademicYear.name == name, AcademicYear.semester == semester)).first()
    if y or not create:
        return y
    start = int(name[:4])
    y = AcademicYear(name=name, semester=semester, is_active=False,
                     start_date=dt.date(start, 7, 13) if semester == "Ganjil" else dt.date(start + 1, 1, 5),
                     end_date=dt.date(start, 12, 18) if semester == "Ganjil" else dt.date(start + 1, 6, 26))
    db.add(y)
    db.flush()
    return y


def run_import(db: Session, kind: str, rows: list[dict], dry_run: bool) -> dict:
    units = {u.code: u for u in db.scalars(select(Unit))}
    results, seen = [], set()
    created = updated = accounts = 0
    apply = not dry_run
    usernames = set(db.scalars(select(User.username)))

    def student_by_nis(nis: str) -> Student | None:
        return db.scalars(select(Student).where(Student.nis == nis)).first() if nis else None

    for i, r in enumerate(rows):
        errors: list[str] = []
        status = "baru"
        label = ""

        if kind == "siswa":
            nis, nama, jk = s(r.get("nis")), s(r.get("nama")), s(r.get("jk")).upper()
            label = f"{nis} · {nama}"
            if not nis: errors.append("NIS wajib diisi")
            if not nama: errors.append("Nama wajib diisi")
            if jk not in ("L", "P"): errors.append("JK harus L atau P")
            unit = units.get(s(r.get("unit")).upper())
            if not unit: errors.append(f'Unit "{s(r.get("unit"))}" tidak dikenal (SD/SMP/SMA/SMK)')
            st_val = s(r.get("status")).lower() or "aktif"
            if st_val not in ("aktif", "lulus", "pindah", "keluar"): errors.append("Status harus aktif/lulus/pindah/keluar")
            kelas = s(r.get("kelas"))
            cls = db.scalars(select(SchoolClass).where(func.lower(SchoolClass.name) == kelas.lower(), SchoolClass.unit_id == unit.id)).first() if kelas and unit else None
            if st_val == "aktif" and not cls:
                errors.append(f'Kelas "{kelas}" tidak ditemukan di unit {unit.code if unit else "-"}' if kelas else "Kelas wajib diisi untuk siswa aktif")
            birth = parse_date(r.get("tanggal_lahir"))
            if birth is False: errors.append("Tanggal lahir tidak valid")
            jalur = s(r.get("jalur_masuk")).lower() or "baru"
            if jalur not in ("baru", "pindahan"): errors.append("Jalur masuk harus baru atau pindahan")
            if nis in seen: errors.append("NIS duplikat di dalam file")
            seen.add(nis)
            existing = student_by_nis(nis)
            if existing: status = "perbarui"
            if not errors and apply:
                hp = s(r.get("hp_ortu"))
                guardian_id = existing.guardian_id if existing else None
                if s(r.get("nama_ortu")):
                    g = db.get(Guardian, guardian_id) if guardian_id else None
                    if not g and hp:
                        g = db.scalars(select(Guardian).where(Guardian.phone == hp)).first()
                    g = g or Guardian()
                    g.name, g.relation, g.phone = s(r.get("nama_ortu")), s(r.get("hubungan_ortu")) or "Orang Tua", hp
                    g.email, g.occupation, g.address = s(r.get("email_ortu")), s(r.get("pekerjaan_ortu")), s(r.get("alamat"))
                    db.add(g)
                    db.flush()
                    guardian_id = g.id
                st = existing or Student(notes="Impor data")
                st.nis, st.nisn, st.name, st.gender = nis, s(r.get("nisn")), nama, jk
                st.birth_place, st.birth_date, st.religion = s(r.get("tempat_lahir")), birth or None, s(r.get("agama")) or "Islam"
                st.address, st.class_id, st.unit_id, st.guardian_id = s(r.get("alamat")), cls.id if st_val == "aktif" else None, unit.id, guardian_id
                st.status, st.entry_type, st.origin_school = st_val, jalur, s(r.get("sekolah_asal"))
                st.entry_year = int(float(s(r.get("tahun_masuk")) or dt.date.today().year))
                st.graduation_year = int(float(s(r.get("tahun_lulus")))) if s(r.get("tahun_lulus")) else None
                db.add(st)
                db.flush()
                if not db.scalars(select(User).where(User.student_id == st.id)).first() and nis not in usernames:
                    db.add(User(username=nis, password_hash=hash_password(DEFAULT_PASSWORD), name=nama, role="siswa", student_id=st.id, is_active=True))
                    usernames.add(nis)
                    accounts += 1
                if guardian_id and hp and not db.scalars(select(User).where(User.guardian_id == guardian_id)).first() and hp not in usernames:
                    db.add(User(username=hp, password_hash=hash_password(DEFAULT_PASSWORD), name=s(r.get("nama_ortu")), role="ortu", guardian_id=guardian_id, is_active=True))
                    usernames.add(hp)
                    accounts += 1

        elif kind == "pegawai":
            nip, nama, jenis = s(r.get("nip")), s(r.get("nama")), s(r.get("jenis")).lower()
            label = f"{nip} · {nama}"
            if not nip: errors.append("NIP wajib diisi")
            if not nama: errors.append("Nama wajib diisi")
            if jenis not in ("guru", "tendik", "pimpinan"): errors.append("Jenis harus guru/tendik/pimpinan")
            if not s(r.get("jabatan")): errors.append("Jabatan wajib diisi")
            unit_str = s(r.get("unit"))
            unit = units.get(unit_str.upper()) if unit_str and unit_str.lower() != "yayasan" else None
            if unit_str and unit_str.lower() != "yayasan" and not unit: errors.append(f'Unit "{unit_str}" tidak dikenal')
            jk = s(r.get("jk")).upper() or "L"
            if jk not in ("L", "P"): errors.append("JK harus L atau P")
            stat = s(r.get("status")) or "GTY"
            if stat not in ("PNS", "PPPK", "GTY", "GTT", "PTY", "Honorer"): errors.append("Status kepegawaian tidak dikenal")
            join = parse_date(r.get("mulai_bertugas"))
            if join is False: errors.append("Tanggal mulai bertugas tidak valid")
            if nip in seen: errors.append("NIP duplikat di dalam file")
            seen.add(nip)
            existing = db.scalars(select(Employee).where(Employee.nip == nip)).first() if nip else None
            if existing: status = "perbarui"
            if not errors and apply:
                e = existing or Employee(is_active=True, supervisor_id=unit.head_id if unit else None)
                e.nip, e.name, e.gender, e.unit_id, e.type = nip, nama, jk, unit.id if unit else None, jenis
                e.position, e.status, e.education = s(r.get("jabatan")), stat, s(r.get("pendidikan")) or "S1"
                e.phone, e.email, e.join_date = s(r.get("hp")), s(r.get("email")), join or None
                db.add(e)
                db.flush()
                if jenis == "guru" and not db.scalars(select(User).where(User.employee_id == e.id)).first() and nip not in usernames:
                    db.add(User(username=nip, password_hash=hash_password(DEFAULT_PASSWORD), name=nama, role="guru", employee_id=e.id, is_active=True))
                    usernames.add(nip)
                    accounts += 1

        elif kind == "buku":
            kode, judul, kategori = s(r.get("kode")), s(r.get("judul")), s(r.get("kategori"))
            label = f"{kode} · {judul}"
            if not kode: errors.append("Kode buku wajib diisi")
            if not judul: errors.append("Judul wajib diisi")
            cats = ["Fiksi", "Nonfiksi", "Buku Pelajaran", "Referensi", "Majalah", "Buku Anak"]
            cat = next((c for c in cats if c.lower() == kategori.lower()), None)
            if not cat: errors.append(f"Kategori harus salah satu: {', '.join(cats)}")
            try:
                raw_copies = float(s(r.get("jumlah_eksemplar")))
                copies = int(raw_copies)
                if copies < 1 or raw_copies != copies: raise ValueError
            except ValueError:
                copies = 0
                errors.append("Jumlah eksemplar harus bilangan bulat ≥ 1")
            year = None
            if s(r.get("tahun")):
                try:
                    year = int(float(s(r.get("tahun"))))
                    if not 1000 <= year <= 2100: raise ValueError
                except ValueError:
                    errors.append("Tahun terbit tidak valid")
            unit_str = s(r.get("unit"))
            unit = units.get(unit_str.upper()) if unit_str else None
            if unit_str and not unit: errors.append(f'Unit "{unit_str}" tidak dikenal')
            if kode.lower() in seen: errors.append("Kode buku duplikat di dalam file")
            seen.add(kode.lower())
            existing = db.scalars(select(Book).where(func.lower(Book.code) == kode.lower())).first() if kode else None
            if existing:
                status = "perbarui"
                on_loan = db.scalar(select(func.count(BookLoan.id)).where(BookLoan.book_id == existing.id, BookLoan.returned_at.is_(None))) or 0
                if copies and copies < on_loan: errors.append(f"Jumlah eksemplar tidak boleh kurang dari yang sedang dipinjam ({on_loan})")
            if not errors and apply:
                b = existing or Book(cover_url="")
                b.code, b.title, b.author, b.publisher, b.year, b.isbn = kode, judul, s(r.get("pengarang")), s(r.get("penerbit")), year, s(r.get("isbn"))
                b.category, b.unit_id, b.location, b.copies, b.description = cat, unit.id if unit else None, s(r.get("lokasi_rak")), copies, s(r.get("deskripsi"))
                db.add(b)

        elif kind in ("riwayat_kelas", "nilai"):
            nis = s(r.get("nis"))
            st = student_by_nis(nis)
            if not nis: errors.append("NIS wajib diisi")
            elif not st: errors.append(f"Siswa dengan NIS {nis} belum terdaftar (impor data siswa terlebih dahulu)")
            name, semester = validate_year(r, errors)
            year = find_year(db, name, semester, False) if not errors else None
            label = f"{nis} · {st.name if st else '?'} · {name} {semester}"

            if kind == "riwayat_kelas":
                kelas = s(r.get("kelas"))
                try:
                    tingkat = int(float(s(r.get("tingkat"))))
                except ValueError:
                    tingkat = 0
                if not kelas: errors.append("Kelas wajib diisi")
                if not 1 <= tingkat <= 12: errors.append("Tingkat harus 1–12")
                sick, permit, absent = parse_count(r.get("sakit"), "Sakit", errors), parse_count(r.get("izin"), "Izin", errors), parse_count(r.get("alpa"), "Alpa", errors)
                kep = s(r.get("keputusan")).lower()
                if kep and kep not in ("naik", "tinggal", "lulus"): errors.append("Keputusan harus naik/tinggal/lulus")
                key = (nis, name, semester)
                if key in seen: errors.append("Baris duplikat (NIS + tahun ajaran + semester)")
                seen.add(key)
                if st and year and db.scalars(select(Enrollment).where(Enrollment.student_id == st.id, Enrollment.academic_year_id == year.id)).first():
                    status = "perbarui"
                if not errors and apply:
                    ay = find_year(db, name, semester, True)
                    en = db.scalars(select(Enrollment).where(Enrollment.student_id == st.id, Enrollment.academic_year_id == ay.id)).first() or Enrollment(student_id=st.id, academic_year_id=ay.id)
                    en.unit_id, en.class_id, en.class_name, en.grade = st.unit_id, None, kelas, tingkat
                    en.homeroom_name, en.sick, en.permit, en.absent = s(r.get("wali_kelas")), sick, permit, absent
                    en.homeroom_note, en.result, en.next_class_name = s(r.get("catatan_wali_kelas")), kep or None, s(r.get("naik_ke"))
                    db.add(en)
            else:
                mapel = s(r.get("mapel"))
                sub = None
                if st and mapel:
                    sub = db.scalars(select(Subject).where(Subject.unit_id == st.unit_id, (func.lower(Subject.code) == mapel.lower()) | (func.lower(Subject.name) == mapel.lower()))).first()
                if not mapel: errors.append("Mapel wajib diisi")
                elif st and not sub: errors.append(f'Mapel "{mapel}" tidak ditemukan di unit siswa')
                g = {
                    "assignment": parse_score(r.get("nilai_tugas"), "Nilai tugas", errors), "daily": parse_score(r.get("nilai_harian"), "Nilai harian", errors),
                    "midterm": parse_score(r.get("nilai_pts"), "Nilai PTS", errors), "final_exam": parse_score(r.get("nilai_pas"), "Nilai PAS", errors),
                }
                final_in = parse_score(r.get("nilai_akhir"), "Nilai akhir", errors)
                final = final_in if final_in is not None else compute_final(g)
                if final is None: errors.append("Isi minimal satu nilai")
                label += f" · {sub.code if sub else mapel}"
                key = (nis, name, semester, sub.id if sub else mapel)
                if key in seen: errors.append("Baris duplikat (NIS + semester + mapel)")
                seen.add(key)
                if st and sub and year and db.scalars(select(Grade).where(Grade.student_id == st.id, Grade.subject_id == sub.id, Grade.academic_year_id == year.id)).first():
                    status = "perbarui"
                if not errors and apply:
                    ay = find_year(db, name, semester, True)
                    gr = db.scalars(select(Grade).where(Grade.student_id == st.id, Grade.subject_id == sub.id, Grade.academic_year_id == ay.id)).first() or Grade(student_id=st.id, subject_id=sub.id, academic_year_id=ay.id)
                    for k, v in g.items():
                        setattr(gr, k, v)
                    gr.final, gr.description = final, s(r.get("deskripsi"))
                    db.add(gr)
        else:
            errors.append(f"Jenis impor '{kind}' tidak dikenal")

        if errors:
            status = "error"
        elif status == "perbarui":
            updated += 1
        else:
            created += 1
        results.append({"row": i + 2, "label": label, "status": status, "errors": errors})

    if apply:
        db.commit()
    else:
        db.rollback()
    failed = sum(1 for x in results if x["status"] == "error")
    return {"total": len(rows), "valid": len(rows) - failed, "created": created, "updated": updated, "failed": failed, "accounts": accounts, "rows": results, "dry_run": dry_run}
