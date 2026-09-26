"""Aksi bisnis: POST /api/actions/{name}.

Setiap aksi di sini adalah padanan server dari `frontend/src/lib/demo/actions.ts`
sehingga perilaku mode demo dan mode live identik.
"""
import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Principal, bearer, ensure_role, get_principal
from ..models import (
    AcademicYear, Announcement, Applicant, Bill, Employee, EmployeeAttendance, Event, Exam, ExamResult,
    Extracurricular, FeeType, Grade, Guardian, Major, Payment, Promotion, SchoolClass, Setting, Student,
    StudentAttendance, Submission, Unit, User,
)
from ..security import hash_password
from ..serialize import to_dict

router = APIRouter(prefix="/api/actions", tags=["actions"])

DEFAULT_PASSWORD = "demo123"
PUBLIC_ACTIONS = {"public.portal", "ppdb.register", "ppdb.status", "ppdb.pay"}


def today() -> dt.date:
    return dt.date.today()


def now() -> dt.datetime:
    return dt.datetime.now().replace(microsecond=0)


def parse_date(v: Any) -> dt.date | None:
    if not v:
        return None
    return v if isinstance(v, dt.date) else dt.date.fromisoformat(str(v)[:10])


def compute_final(g: dict) -> float | None:
    parts = [(g.get("assignment"), 0.3), (g.get("daily"), 0.2), (g.get("midterm"), 0.2), (g.get("final_exam"), 0.3)]
    present = [(v, w) for v, w in parts if isinstance(v, (int, float))]
    if not present:
        return None
    total_w = sum(w for _, w in present)
    return round(sum(v * w for v, w in present) / total_w, 1)


def receipt_no(db: Session) -> str:
    n = (db.scalar(select(func.count(Payment.id))) or 0) + 1
    return f"KW/{today():%Y%m}/{n:05d}"


def apply_payment(db: Session, bill: Bill, amount: int, method: str, received_by: str, note: str = "") -> Payment:
    remaining = bill.amount - bill.discount - bill.paid_amount
    if amount <= 0:
        raise HTTPException(400, "Nominal pembayaran tidak valid")
    if amount > remaining:
        raise HTTPException(400, f"Nominal melebihi sisa tagihan ({remaining:,})".replace(",", "."))
    pay = Payment(bill_id=bill.id, student_id=bill.student_id, applicant_id=bill.applicant_id, amount=amount, method=method,
                  receipt_no=receipt_no(db), paid_at=now(), received_by=received_by, note=note or "")
    db.add(pay)
    bill.paid_amount += amount
    bill.status = "lunas" if bill.paid_amount >= bill.amount - bill.discount else "sebagian"
    return pay


# ------------------------------------------------------------------ public
def public_portal(db: Session, p: dict, user: Principal | None):
    settings = db.scalars(select(Setting)).first()
    return {
        "settings": to_dict(settings) if settings else None,
        "units": [to_dict(u) for u in db.scalars(select(Unit).order_by(Unit.id))],
        "majors": [to_dict(m) for m in db.scalars(select(Major))],
        "announcements": [to_dict(a) for a in db.scalars(select(Announcement).where(Announcement.is_public).order_by(Announcement.published_at.desc()))],
        "events": [to_dict(e) for e in db.scalars(select(Event).where(Event.date >= today()).order_by(Event.date))],
        "fee_types": [to_dict(f) for f in db.scalars(select(FeeType).where(FeeType.category.in_(["pendaftaran", "bulanan"])))],
        "stats": {
            "students": db.scalar(select(func.count(Student.id)).where(Student.status == "aktif")),
            "teachers": db.scalar(select(func.count(Employee.id)).where(Employee.type == "guru", Employee.is_active)),
            "classes": db.scalar(select(func.count(SchoolClass.id))),
            "alumni": (db.scalar(select(func.count(Student.id)).where(Student.status == "lulus")) or 0) + 1250,
        },
    }


def ppdb_register(db: Session, p: dict, user: Principal | None):
    settings = db.scalars(select(Setting)).first()
    if settings and not settings.ppdb_open:
        raise HTTPException(400, "Pendaftaran sedang ditutup")
    unit = db.get(Unit, int(p.get("unit_id") or 0))
    if not unit:
        raise HTTPException(400, "Unit tidak valid")
    for field in ("name", "birth_date", "parent_name", "parent_phone"):
        if not p.get(field):
            raise HTTPException(422, f"Field '{field}' wajib diisi")
    count = db.scalar(select(func.count(Applicant.id))) or 0
    a = Applicant(
        reg_no=f"PPDB-{today().year + 1}-{unit.code}-{count + 1:04d}", type=p.get("type") or "baru", unit_id=unit.id,
        grade_target=int(p.get("grade_target") or unit.min_grade), major_id=int(p["major_id"]) if p.get("major_id") else None,
        name=p["name"], gender=p.get("gender") or "L", birth_place=p.get("birth_place") or "", birth_date=parse_date(p.get("birth_date")),
        religion=p.get("religion") or "Islam", nisn=p.get("nisn") or "", origin_school=p.get("origin_school") or "",
        transfer_reason=p.get("transfer_reason") or "", address=p.get("address") or "", parent_name=p["parent_name"],
        parent_phone=p["parent_phone"], parent_email=p.get("parent_email") or "", parent_occupation=p.get("parent_occupation") or "",
        status="baru", created_at=now(),
    )
    db.add(a)
    db.flush()
    fee = db.scalars(select(FeeType).where(FeeType.unit_id == unit.id, FeeType.category == "pendaftaran", FeeType.name.like("Biaya Pendaftaran%"))).first()
    bill = None
    if fee:
        bill = Bill(student_id=None, applicant_id=a.id, fee_type_id=fee.id, period=f"{today():%Y-%m}", description=f"{fee.name} - {a.reg_no}",
                    amount=fee.amount, discount=0, paid_amount=0, due_date=today() + dt.timedelta(days=7), status="belum", created_at=now())
        db.add(bill)
    db.commit()
    return {"applicant": to_dict(a), "bill": to_dict(bill) if bill else None}


def ppdb_status(db: Session, p: dict, user: Principal | None):
    a = db.scalars(select(Applicant).where(func.lower(Applicant.reg_no) == str(p.get("reg_no", "")).strip().lower(), Applicant.birth_date == parse_date(p.get("birth_date")))).first()
    if not a:
        raise HTTPException(404, "Data pendaftaran tidak ditemukan. Periksa nomor pendaftaran dan tanggal lahir.")
    bills = db.scalars(select(Bill).where(Bill.applicant_id == a.id))
    return {"applicant": to_dict(a), "bills": [to_dict(b) for b in bills], "unit": to_dict(db.get(Unit, a.unit_id))}


def ppdb_pay(db: Session, p: dict, user: Principal | None):
    bill = db.get(Bill, int(p.get("bill_id") or 0))
    if not bill or not bill.applicant_id:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    # Produksi: ganti dengan pembuatan transaksi di payment gateway + callback terverifikasi.
    pay = apply_payment(db, bill, bill.amount - bill.discount - bill.paid_amount, p.get("method") or "Virtual Account", "Pembayaran Online")
    db.commit()
    return to_dict(pay)


# ------------------------------------------------------------------ PPDB / kesiswaan
def ppdb_enroll(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kesiswaan")
    a = db.get(Applicant, int(p.get("applicant_id") or 0))
    if not a:
        raise HTTPException(404, "Pendaftar tidak ditemukan")
    if a.status != "diterima":
        raise HTTPException(400, 'Hanya pendaftar berstatus "diterima" yang dapat didaftarkan ulang')
    cls = db.get(SchoolClass, int(p.get("class_id") or 0))
    if not cls:
        raise HTTPException(400, "Pilih kelas tujuan")
    g = Guardian(name=a.parent_name, relation="Orang Tua", phone=a.parent_phone, email=a.parent_email, occupation=a.parent_occupation, address=a.address)
    db.add(g)
    db.flush()
    year = today().year
    seq = (db.scalar(select(func.count(Student.id)).where(Student.unit_id == a.unit_id)) or 0) + 1
    s = Student(nis=f"{year % 100:02d}{a.unit_id}{seq:04d}", nisn=a.nisn, name=a.name, gender=a.gender, birth_place=a.birth_place, birth_date=a.birth_date,
                religion=a.religion, address=a.address, class_id=cls.id, unit_id=a.unit_id, guardian_id=g.id, status="aktif", entry_year=year,
                entry_type=a.type, origin_school=a.origin_school, notes=f"Mutasi masuk: {a.transfer_reason}" if a.type == "pindahan" else "")
    db.add(s)
    db.flush()
    parent_username = a.parent_phone or f"ortu{g.id}"
    db.add(User(username=s.nis, password_hash=hash_password(DEFAULT_PASSWORD), name=s.name, role="siswa", student_id=s.id, is_active=True))
    if not db.scalars(select(User).where(User.username == parent_username)).first():
        db.add(User(username=parent_username, password_hash=hash_password(DEFAULT_PASSWORD), name=g.name, role="ortu", guardian_id=g.id, is_active=True))
    pangkal = db.scalars(select(FeeType).where(FeeType.unit_id == a.unit_id, FeeType.name.like("Uang Pangkal%"))).first()
    if pangkal:
        db.add(Bill(student_id=s.id, fee_type_id=pangkal.id, period=f"{today():%Y-%m}", description=f"{pangkal.name} - {s.name}", amount=pangkal.amount,
                    discount=0, paid_amount=0, due_date=today() + dt.timedelta(days=30), status="belum", created_at=now()))
    a.status = "daftar_ulang"
    a.student_id = s.id
    db.commit()
    return {"student": to_dict(s), "username": s.nis, "parent_username": parent_username, "password": DEFAULT_PASSWORD}


def students_mutate(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kesiswaan")
    s = db.get(Student, int(p.get("student_id") or 0))
    if not s:
        raise HTTPException(404, "Siswa tidak ditemukan")
    s.status = p.get("status") or s.status
    if s.status != "aktif":
        s.class_id = None
    s.notes = "\n".join(x for x in [s.notes, p.get("note") or ""] if x)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ keuangan
def bills_generate(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "keuangan")
    fee = db.get(FeeType, int(p.get("fee_type_id") or 0))
    if not fee:
        raise HTTPException(404, "Jenis biaya tidak ditemukan")
    stmt = select(Student).where(Student.status == "aktif")
    if fee.unit_id:
        stmt = stmt.where(Student.unit_id == fee.unit_id)
    if p.get("unit_id"):
        stmt = stmt.where(Student.unit_id == int(p["unit_id"]))
    if p.get("class_id"):
        stmt = stmt.where(Student.class_id == int(p["class_id"]))
    period = p.get("period")
    existing = set(db.scalars(select(Bill.student_id).where(Bill.fee_type_id == fee.id, Bill.period == period)))
    created = skipped = 0
    for s in db.scalars(stmt):
        if s.id in existing:
            skipped += 1
            continue
        db.add(Bill(student_id=s.id, fee_type_id=fee.id, period=period, description=p.get("description") or f"{fee.name} {period}", amount=fee.amount,
                    discount=0, paid_amount=0, due_date=parse_date(p.get("due_date")) or today(), status="belum", created_at=now()))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


def payments_pay(db: Session, p: dict, user: Principal):
    bill = db.get(Bill, int(p.get("bill_id") or 0))
    if not bill:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if user.is_family:
        if bill.student_id not in user.student_ids:
            raise HTTPException(403, "Tagihan bukan milik Anda")
        received_by = "Pembayaran Online"
    else:
        ensure_role(user, "admin", "keuangan")
        received_by = user.user.name
    pay = apply_payment(db, bill, int(p.get("amount") or 0), p.get("method") or "Tunai", received_by, p.get("note") or "")
    db.commit()
    return to_dict(pay)


# ------------------------------------------------------------------ presensi
def attendance_save_class(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kesiswaan", "guru")
    date = parse_date(p.get("date"))
    class_id = int(p.get("class_id") or 0)
    for e in p.get("entries") or []:
        row = db.scalars(select(StudentAttendance).where(StudentAttendance.student_id == e["student_id"], StudentAttendance.date == date)).first()
        if row:
            row.status, row.note, row.class_id = e["status"], e.get("note") or "", class_id
        else:
            db.add(StudentAttendance(date=date, class_id=class_id, student_id=e["student_id"], status=e["status"], note=e.get("note") or ""))
    db.commit()
    return {"saved": len(p.get("entries") or [])}


def _own_employee(p: dict, user: Principal) -> int:
    emp_id = int(p.get("employee_id") or 0)
    if user.role != "admin" and emp_id != user.user.employee_id:
        raise HTTPException(403, "Hanya dapat melakukan presensi untuk diri sendiri")
    return emp_id


def attendance_checkin(db: Session, p: dict, user: Principal):
    emp_id = _own_employee(p, user)
    row = db.scalars(select(EmployeeAttendance).where(EmployeeAttendance.employee_id == emp_id, EmployeeAttendance.date == today())).first()
    if row and row.check_in:
        raise HTTPException(400, "Anda sudah melakukan presensi masuk hari ini")
    t = now().strftime("%H:%M")
    if row:
        row.check_in, row.status = t, "H"
    else:
        row = EmployeeAttendance(date=today(), employee_id=emp_id, check_in=t, status="H", note="")
        db.add(row)
    db.commit()
    return to_dict(row)


def attendance_checkout(db: Session, p: dict, user: Principal):
    emp_id = _own_employee(p, user)
    row = db.scalars(select(EmployeeAttendance).where(EmployeeAttendance.employee_id == emp_id, EmployeeAttendance.date == today())).first()
    if not row or not row.check_in:
        raise HTTPException(400, "Belum melakukan presensi masuk")
    row.check_out = now().strftime("%H:%M")
    db.commit()
    return to_dict(row)


def attendance_set_employee(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin")
    date = parse_date(p.get("date"))
    row = db.scalars(select(EmployeeAttendance).where(EmployeeAttendance.employee_id == int(p["employee_id"]), EmployeeAttendance.date == date)).first()
    if row:
        row.status, row.note = p["status"], p.get("note") or ""
    else:
        db.add(EmployeeAttendance(date=date, employee_id=int(p["employee_id"]), status=p["status"], note=p.get("note") or ""))
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ pembelajaran
def _own_student(p: dict, user: Principal) -> int:
    sid = int(p.get("student_id") or 0)
    if user.role != "siswa" or sid not in user.student_ids:
        raise HTTPException(403, "Hanya siswa yang bersangkutan yang dapat mengerjakan")
    return sid


def submissions_submit(db: Session, p: dict, user: Principal):
    sid = _own_student(p, user)
    row = db.scalars(select(Submission).where(Submission.assignment_id == int(p["assignment_id"]), Submission.student_id == sid)).first()
    if row and row.score is not None:
        raise HTTPException(400, "Tugas sudah dinilai, tidak dapat diubah")
    if row:
        row.content, row.submitted_at = p.get("content") or "", now()
    else:
        row = Submission(assignment_id=int(p["assignment_id"]), student_id=sid, content=p.get("content") or "", submitted_at=now(), feedback="")
        db.add(row)
    db.commit()
    return to_dict(row)


def exams_submit(db: Session, p: dict, user: Principal):
    sid = _own_student(p, user)
    exam = db.get(Exam, int(p.get("exam_id") or 0))
    if not exam:
        raise HTTPException(404, "Ujian tidak ditemukan")
    if db.scalars(select(ExamResult).where(ExamResult.exam_id == exam.id, ExamResult.student_id == sid)).first():
        raise HTTPException(400, "Anda sudah mengerjakan ujian ini")
    answers = list(p.get("answers") or [])
    questions = exam.questions or []
    correct = sum(1 for i, q in enumerate(questions) if i < len(answers) and answers[i] == q.get("answer"))
    score = round(correct / len(questions) * 100) if questions else 0
    row = ExamResult(exam_id=exam.id, student_id=sid, answers=answers, score=score, submitted_at=now())
    db.add(row)
    db.commit()
    return {**to_dict(row), "correct": correct, "total": len(questions)}


def grades_save(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "guru")
    rows = p.get("rows") or []
    for r in rows:
        g = db.scalars(select(Grade).where(Grade.student_id == r["student_id"], Grade.subject_id == r["subject_id"], Grade.academic_year_id == r["academic_year_id"])).first()
        if not g:
            g = Grade(student_id=r["student_id"], subject_id=r["subject_id"], academic_year_id=r["academic_year_id"], description="")
            db.add(g)
        for k in ("assignment", "daily", "midterm", "final_exam"):
            setattr(g, k, r.get(k))
        if r.get("description") is not None:
            g.description = r["description"]
        g.final = compute_final(r)
    db.commit()
    return {"saved": len(rows)}


def promotions_process(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kepsek", "kesiswaan")
    decisions = p.get("decisions") or []
    for d in decisions:
        s = db.get(Student, int(d["student_id"]))
        if not s:
            continue
        db.add(Promotion(student_id=s.id, academic_year_id=int(p["academic_year_id"]), from_class_id=s.class_id,
                         to_class_id=None if d["result"] == "lulus" else d.get("to_class_id"), result=d["result"], note=d.get("note") or "", processed_at=now()))
        if d["result"] == "lulus":
            s.status, s.class_id, s.graduation_year = "lulus", None, today().year
        elif d.get("to_class_id"):
            s.class_id = int(d["to_class_id"])
    db.commit()
    return {"processed": len(decisions)}


def academic_years_activate(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin")
    for y in db.scalars(select(AcademicYear)):
        y.is_active = y.id == int(p["id"])
    db.commit()
    return {"ok": True}


def ekskul_toggle(db: Session, p: dict, user: Principal):
    e = db.get(Extracurricular, int(p.get("id") or 0))
    if not e:
        raise HTTPException(404, "Ekstrakurikuler tidak ditemukan")
    sid = int(p.get("student_id") or 0)
    if user.role == "siswa":
        _own_student(p, user)
    else:
        ensure_role(user, "admin", "kesiswaan")
    members = list(e.member_ids or [])
    e.member_ids = [m for m in members if m != sid] if sid in members else [*members, sid]
    db.commit()
    return to_dict(e)


HANDLERS = {
    "public.portal": public_portal,
    "ppdb.register": ppdb_register,
    "ppdb.status": ppdb_status,
    "ppdb.pay": ppdb_pay,
    "ppdb.enroll": ppdb_enroll,
    "students.mutate": students_mutate,
    "bills.generate": bills_generate,
    "payments.pay": payments_pay,
    "attendance.saveClass": attendance_save_class,
    "attendance.checkin": attendance_checkin,
    "attendance.checkout": attendance_checkout,
    "attendance.setEmployee": attendance_set_employee,
    "submissions.submit": submissions_submit,
    "exams.submit": exams_submit,
    "grades.save": grades_save,
    "promotions.process": promotions_process,
    "academic_years.activate": academic_years_activate,
    "ekskul.toggle": ekskul_toggle,
}


@router.post("/{name}")
def run_action(name: str, payload: dict[str, Any] | None = None, db: Session = Depends(get_db), creds=Depends(bearer)):
    handler = HANDLERS.get(name)
    if not handler:
        raise HTTPException(404, f"Aksi '{name}' tidak dikenal")
    user = None if name in PUBLIC_ACTIONS else get_principal(creds, db)
    return handler(db, payload or {}, user)

