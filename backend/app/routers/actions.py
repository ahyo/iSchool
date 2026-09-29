"""Aksi bisnis: POST /api/actions/{name}.

Setiap aksi di sini adalah padanan server dari `frontend/src/lib/demo/actions.ts`
sehingga perilaku mode demo dan mode live identik.
"""
import datetime as dt
import hmac
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Principal, bearer, ensure_role, get_principal
from ..models import (
    AcademicYear, Announcement, Applicant, Bill, Employee, EmployeeAttendance, Event, Exam, ExamResult,
    Book, BookLoan, BookReservation, Discussion, ExamAttempt, ExamCheckin, ExamDispensation, ExamPeriod, ExamWindow, Enrollment, Extracurricular, LeaveRequest, FeeType, Grade, Guardian, Lesson, LessonProgress, Major, Payment, Promotion, SchoolClass,
    Setting, Student, StudentAttendance, Subject, Submission, Unit, User, VirtualClass,
)
from ..cbt import GRACE, at, availability, effective_score
from ..examcard import card_payload, card_token, eligibility, parse_payload, period_for_exam
from ..importer import run_import
from ..scoring import empty_answer, is_answered, public_question, q_points, q_type, score_answers
from ..security import hash_password, verify_password
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
    """Nomor kwitansi berurutan per bulan: urutan tertinggi bulan ini + 1 (aman walau ada data terhapus)."""
    prefix = f"KW/{today():%Y%m}/"
    existing = db.scalars(select(Payment.receipt_no).where(Payment.receipt_no.like(prefix + "%")))
    last = max((int(r[len(prefix):]) for r in existing if r[len(prefix):].isdigit()), default=0)
    return f"{prefix}{last + 1:05d}"




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
    bills = list(db.scalars(select(Bill).where(Bill.applicant_id == a.id)))
    pays = db.scalars(select(Payment).where(Payment.bill_id.in_([b.id for b in bills] or [-1])))
    return {"applicant": to_dict(a), "bills": [to_dict(b) for b in bills], "unit": to_dict(db.get(Unit, a.unit_id)),
            "payments": [{"bill_id": x.bill_id, "amount": x.amount, "status": x.status, "reject_reason": x.reject_reason, "paid_at": x.paid_at.isoformat()} for x in pays]}


def ppdb_pay(db: Session, p: dict, user: Principal | None):
    bill = db.get(Bill, int(p.get("bill_id") or 0))
    if not bill or not bill.applicant_id:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    # Produksi: ganti dengan pembuatan transaksi di payment gateway + callback terverifikasi.
    method = p.get("method") or "Virtual Account"
    if method == "Transfer Bank" and not (p.get("reference") or "").strip():
        raise HTTPException(422, "Isi nomor referensi / nama pengirim transfer")
    pay = apply_payment(db, bill, bill.amount - bill.discount - bill.paid_amount, method, "Pembayaran Online", "Biaya pendaftaran PPDB",
                        pending=True, reference=p.get("reference") or "", proof_url=p.get("proof_url") or "")
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
    method = p.get("method") or "Tunai"
    if user.is_family:
        if bill.student_id not in user.student_ids:
            raise HTTPException(403, "Tagihan bukan milik Anda")
        if method == "Tunai":
            raise HTTPException(400, "Pembayaran tunai dilakukan di loket keuangan sekolah")
        if method == "Transfer Bank" and not (p.get("reference") or "").strip():
            raise HTTPException(422, "Isi nomor referensi / nama pengirim transfer")
        received_by = "Pembayaran Online"
    else:
        ensure_role(user, "admin", "keuangan")
        received_by = user.user.name
    pay = apply_payment(db, bill, int(p.get("amount") or 0), method, received_by, p.get("note") or "",
                        pending=user.is_family, reference=p.get("reference") or "", proof_url=p.get("proof_url") or "")
    _sync_loan_fine(db, bill)
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




def _finalize_attempt(db: Session, attempt: ExamAttempt, answers: list) -> dict:
    exam = db.get(Exam, attempt.exam_id)
    r = score_answers(exam.questions or [], answers)
    attempt.answers, attempt.submitted_at = answers, now()
    row = ExamResult(exam_id=exam.id, student_id=attempt.student_id, answers=answers, score=r["score"], submitted_at=now(), kind=attempt.kind,
                     points=r["points"], pending_essay=r["pending_essay"])
    db.add(row)
    db.flush()
    return {**to_dict(row), "correct": r["correct"], "total": r["total"]}


def _finalize_expired(db: Session, exam_id: int, student_id: int) -> None:
    for a in db.scalars(select(ExamAttempt).where(ExamAttempt.exam_id == exam_id, ExamAttempt.student_id == student_id, ExamAttempt.submitted_at.is_(None))):
        if a.deadline + GRACE < now():
            _finalize_attempt(db, a, a.answers or [])


def _own_attempt(db: Session, p: dict, user: Principal) -> ExamAttempt:
    a = db.get(ExamAttempt, int(p.get("attempt_id") or 0))
    if not a or user.role != "siswa" or a.student_id not in user.student_ids:
        raise HTTPException(404, "Sesi ujian tidak ditemukan")
    if a.submitted_at:
        raise HTTPException(400, "Ujian sudah dikumpulkan")
    return a


def exams_start(db: Session, p: dict, user: Principal):
    sid = _own_student(p, user)
    exam = db.get(Exam, int(p.get("exam_id") or 0))
    st = db.get(Student, sid)
    if not exam:
        raise HTTPException(404, "Ujian tidak ditemukan")
    if st.class_id != exam.class_id:
        raise HTTPException(403, "Ujian bukan untuk kelas Anda")
    if not exam.is_online:
        raise HTTPException(400, "Ujian ini dilaksanakan secara luring")
    subject = db.get(Subject, exam.subject_id)
    kkm = subject.kkm if subject else 75
    _finalize_expired(db, exam.id, sid)
    db.commit()  # simpan penutupan otomatis sesi yang kedaluwarsa sebelum pengecekan berikutnya
    av = availability(db, exam, sid, kkm, now())
    if av["state"] == "resume":
        attempt = av["attempt"]
    elif av["state"] == "open":
        s = av["session"]
        period = period_for_exam(db, exam.type, s["date"], st.unit_id)
        if period and not eligibility(db, period, st)["eligible"]:
            raise HTTPException(403, "Kartu ujian belum terbit: selesaikan persyaratan administrasi terlebih dahulu")
        deadline = min(now() + dt.timedelta(minutes=exam.duration), at(s["date"], s["end_time"]))
        attempt = ExamAttempt(exam_id=exam.id, student_id=sid, kind=s["kind"], window_id=s["window_id"], started_at=now(), deadline=deadline,
                              answers=[empty_answer(q) for q in exam.questions or []], submitted_at=None)
        db.add(attempt)
    elif av["state"] == "upcoming":
        s = av["session"]
        raise HTTPException(400, f"Ujian dibuka {s['date']:%d-%m-%Y} pukul {s['start_time']}")
    elif av["state"] == "done":
        raise HTTPException(400, "Anda sudah mengerjakan ujian ini")
    else:
        raise HTTPException(400, av["reason"])
    db.commit()
    questions = [public_question(q) for q in exam.questions or []]
    return {"attempt": to_dict(attempt), "questions": questions, "server_now": now().isoformat()}


def exams_save_answers(db: Session, p: dict, user: Principal):
    a = _own_attempt(db, p, user)
    if a.deadline + GRACE < now():
        raise HTTPException(400, "Waktu ujian telah habis")
    a.answers = list(p.get("answers") or [])
    db.commit()
    return {"saved": True}


def exams_submit(db: Session, p: dict, user: Principal):
    a = _own_attempt(db, p, user)
    # Jawaban baru diterima hingga 60 detik setelah batas waktu; setelahnya dipakai jawaban tersimpan
    answers = list(p["answers"]) if p.get("answers") is not None and now() <= a.deadline + GRACE else (a.answers or [])
    res = _finalize_attempt(db, a, answers)
    db.commit()
    return res


def _exam_owner(db: Session, exam_id: int, user: Principal) -> Exam:
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, "Ujian tidak ditemukan")
    if not (user.role == "admin" or (user.role == "guru" and exam.teacher_id == user.user.employee_id)):
        raise HTTPException(403, "Hanya guru pengampu yang dapat menjadwalkan")
    return exam


def exams_grade_essay(db: Session, p: dict, user: Principal):
    res = db.get(ExamResult, int(p.get("result_id") or 0))
    if not res:
        raise HTTPException(404, "Hasil ujian tidak ditemukan")
    exam = _exam_owner(db, res.exam_id, user)
    questions = exam.questions or []
    essay = list(res.points or [None] * len(questions))
    essay += [None] * (len(questions) - len(essay))
    for k, v in (p.get("points") or {}).items():
        i = int(k)
        if i >= len(questions) or q_type(questions[i]) != "esai":
            continue
        if v is not None and (not isinstance(v, (int, float)) or v < 0 or v > q_points(questions[i])):
            raise HTTPException(422, f"Nilai soal {i + 1} harus 0–{q_points(questions[i])}")
        essay[i] = v
    r = score_answers(questions, res.answers or [], [essay[i] if q_type(q) == "esai" else None for i, q in enumerate(questions)])
    res.score, res.points, res.pending_essay = r["score"], r["points"], r["pending_essay"]
    db.commit()
    return to_dict(res)


def exams_window_create(db: Session, p: dict, user: Principal):
    exam = _exam_owner(db, int(p.get("exam_id") or 0), user)
    kind = p.get("kind")
    if kind not in ("susulan", "remedial"):
        raise HTTPException(422, "Jenis harus susulan atau remedial")
    date, start, end = parse_date(p.get("date")), p.get("start_time") or "", p.get("end_time") or ""
    if not date or not start or not end or end <= start:
        raise HTTPException(422, "Jadwal tidak valid")
    ids = [int(x) for x in p.get("student_ids") or []]
    if not ids:
        raise HTTPException(422, "Pilih minimal satu siswa")
    subject = db.get(Subject, exam.subject_id)
    kkm = subject.kkm if subject else 75
    for sid in ids:
        rs = list(db.scalars(select(ExamResult).where(ExamResult.exam_id == exam.id, ExamResult.student_id == sid)))
        st = db.get(Student, sid)
        if not st or st.class_id != exam.class_id:
            raise HTTPException(400, "Siswa bukan peserta ujian ini")
        if kind == "susulan" and any(r.kind != "remedial" for r in rs):
            raise HTTPException(400, f"{st.name} sudah mengikuti ujian")
        if kind == "remedial" and ((effective_score(rs, kkm) if rs else kkm) >= kkm or any(r.kind == "remedial" for r in rs)):
            raise HTTPException(400, f"{st.name} tidak memerlukan remedial")
    w = ExamWindow(exam_id=exam.id, kind=kind, date=date, start_time=start, end_time=end, student_ids=ids, notes=p.get("notes") or "", created_by=user.user.name, created_at=now())
    db.add(w)
    db.commit()
    return to_dict(w)


def exams_window_delete(db: Session, p: dict, user: Principal):
    w = db.get(ExamWindow, int(p.get("id") or 0))
    if not w:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    _exam_owner(db, w.exam_id, user)
    db.delete(w)
    db.commit()
    return {"ok": True}


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


def snapshot_enrollment(db: Session, s: Student, academic_year_id: int, **extra) -> Enrollment:
    """Buat/perbarui arsip kelas siswa pada semester tertentu (kelas, wali kelas, kehadiran, catatan)."""
    ay = db.get(AcademicYear, academic_year_id)
    row = db.scalars(select(Enrollment).where(Enrollment.student_id == s.id, Enrollment.academic_year_id == academic_year_id)).first()
    cls = db.get(SchoolClass, s.class_id) if s.class_id else None
    if cls:
        att = select(StudentAttendance.status).where(StudentAttendance.student_id == s.id)
        if ay:
            att = att.where(StudentAttendance.date >= ay.start_date, StudentAttendance.date <= ay.end_date)
        statuses = list(db.scalars(att))
        finals = [f for f in db.scalars(select(Grade.final).where(Grade.student_id == s.id, Grade.academic_year_id == academic_year_id)) if f is not None]
        mean = sum(finals) / len(finals) if finals else 0
        homeroom = db.get(Employee, cls.homeroom_id) if cls.homeroom_id else None
        snap = dict(unit_id=s.unit_id, class_id=cls.id, class_name=cls.name, grade=cls.grade, homeroom_name=homeroom.name if homeroom else "-",
                    sick=statuses.count("S"), permit=statuses.count("I"), absent=statuses.count("A"))
        note = ("Prestasi belajar sangat baik. Pertahankan!" if mean >= 85 else "Hasil belajar baik. Tingkatkan konsistensi belajar." if mean >= 75
                else "Perlu meningkatkan semangat dan kedisiplinan belajar.")
    else:
        snap, note = {}, ""
    if not row:
        if not cls:
            raise HTTPException(400, f"Siswa {s.name} tidak memiliki kelas untuk diarsipkan")
        row = Enrollment(student_id=s.id, academic_year_id=academic_year_id, homeroom_note=note, result=None, next_class_name="", **snap)
        db.add(row)
    else:
        for k, v in snap.items():
            setattr(row, k, v)
        if not row.homeroom_note:
            row.homeroom_note = note
    for k, v in extra.items():
        setattr(row, k, v)
    return row


def academic_years_archive(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin")
    ay = db.get(AcademicYear, int(p.get("id") or 0))
    if not ay:
        raise HTTPException(404, "Tahun ajaran tidak ditemukan")
    students = list(db.scalars(select(Student).where(Student.status == "aktif", Student.class_id.is_not(None))))
    for s in students:
        snapshot_enrollment(db, s, ay.id)
    db.commit()
    return {"archived": len(students)}


def promotions_process(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kepsek", "kesiswaan")
    decisions = p.get("decisions") or []
    for d in decisions:
        s = db.get(Student, int(d["student_id"]))
        if not s:
            continue
        next_cls = db.get(SchoolClass, int(d["to_class_id"])) if d.get("to_class_id") and d["result"] != "lulus" else None
        snapshot_enrollment(db, s, int(p["academic_year_id"]), result=d["result"], next_class_name=next_cls.name if next_cls else "")
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


# ------------------------------------------------------------------ e-learning
def elearning_complete(db: Session, p: dict, user: Principal):
    sid = _own_student(p, user)
    lesson = db.get(Lesson, int(p.get("lesson_id") or 0))
    if not lesson or not lesson.is_published:
        raise HTTPException(404, "Pelajaran tidak ditemukan")
    student = db.get(Student, sid)
    if not student or student.class_id != lesson.class_id:
        raise HTTPException(403, "Pelajaran bukan untuk kelas Anda")
    score, correct, quiz = None, 0, lesson.quiz or []
    if lesson.type == "kuis":
        answers = list(p.get("answers") or [])
        if any(not is_answered(q, answers[i] if i < len(answers) else None) for i, q in enumerate(quiz)):
            raise HTTPException(400, "Jawab semua pertanyaan kuis terlebih dahulu")
        r = score_answers(quiz, answers)
        correct, score = r["correct"], r["score"]
    row = db.scalars(select(LessonProgress).where(LessonProgress.lesson_id == lesson.id, LessonProgress.student_id == sid)).first()
    if row:
        row.completed_at = now()
        if score is not None:
            row.quiz_score = max(row.quiz_score or 0, score)
    else:
        row = LessonProgress(lesson_id=lesson.id, student_id=sid, completed_at=now(), quiz_score=score)
        db.add(row)
    db.commit()
    return {"progress": to_dict(row), "score": score, "correct": correct, "total": len(quiz)}


def elearning_join(db: Session, p: dict, user: Principal):
    vc = db.get(VirtualClass, int(p.get("virtual_class_id") or 0))
    if not vc:
        raise HTTPException(404, "Kelas virtual tidak ditemukan")
    if user.role == "siswa":
        sid = _own_student(p, user)
        student = db.get(Student, sid)
        if student.class_id != vc.class_id:
            raise HTTPException(403, "Kelas virtual bukan untuk kelas Anda")
        if vc.date != today():
            raise HTTPException(400, "Kelas virtual hanya dapat diikuti pada hari pelaksanaan")
        if sid not in (vc.attendee_ids or []):
            vc.attendee_ids = [*(vc.attendee_ids or []), sid]
            db.commit()
    return {"link": vc.link}


def discussions_post(db: Session, p: dict, user: Principal):
    if user.role == "ortu":
        raise HTTPException(403, "Orang tua hanya dapat membaca diskusi")
    body, title = (p.get("body") or "").strip(), (p.get("title") or "").strip()
    if not body:
        raise HTTPException(422, "Isi diskusi tidak boleh kosong")
    parent_id = p.get("parent_id") or None
    if not parent_id and not title:
        raise HTTPException(422, "Judul topik wajib diisi")
    class_id, subject_id = int(p["class_id"]), int(p["subject_id"])
    if user.role == "siswa":
        student = db.get(Student, next(iter(user.student_ids), 0))
        if not student or student.class_id != class_id:
            raise HTTPException(403, "Anda bukan anggota kelas ini")
    row = Discussion(class_id=class_id, subject_id=subject_id, parent_id=parent_id, user_id=user.user.id, author=user.user.name,
                     author_role=user.role, title=title, body=body, pinned=False, created_at=now())
    db.add(row)
    db.commit()
    return to_dict(row)


def discussions_delete(db: Session, p: dict, user: Principal):
    row = db.get(Discussion, int(p.get("id") or 0))
    if not row:
        raise HTTPException(404, "Diskusi tidak ditemukan")
    if row.user_id != user.user.id and user.role not in ("guru", "admin"):
        raise HTTPException(403, "Anda tidak dapat menghapus diskusi ini")
    for r in db.scalars(select(Discussion).where(Discussion.parent_id == row.id)):
        db.delete(r)
    db.flush()
    db.delete(row)
    db.commit()
    return {"ok": True}


def discussions_pin(db: Session, p: dict, user: Principal):
    ensure_role(user, "guru", "admin")
    row = db.get(Discussion, int(p.get("id") or 0))
    if not row:
        raise HTTPException(404, "Diskusi tidak ditemukan")
    row.pinned = not row.pinned
    db.commit()
    return to_dict(row)


# ------------------------------------------------------------------ impor, akun, izin
IMPORT_ROLES = {"siswa": ("admin", "kesiswaan"), "pegawai": ("admin",), "riwayat_kelas": ("admin", "kesiswaan"), "nilai": ("admin", "kesiswaan"), "buku": ("admin", "pustakawan")}


def import_run(db: Session, p: dict, user: Principal):
    kind = p.get("kind")
    if kind not in IMPORT_ROLES:
        raise HTTPException(400, "Jenis impor tidak dikenal")
    ensure_role(user, *IMPORT_ROLES[kind])
    rows = p.get("rows") or []
    if not isinstance(rows, list) or not rows:
        raise HTTPException(400, "File tidak berisi data")
    if len(rows) > 20000:
        raise HTTPException(400, "Maksimal 20.000 baris per impor")
    return run_import(db, kind, rows, p.get("dry_run") is not False)


def auth_change_password(db: Session, p: dict, user: Principal):
    u = db.get(User, user.user.id)
    if not verify_password(p.get("old_password") or "", u.password_hash):
        raise HTTPException(400, "Password lama salah")
    new = p.get("new_password") or ""
    if len(new) < 6:
        raise HTTPException(422, "Password baru minimal 6 karakter")
    u.password_hash = hash_password(new)
    db.commit()
    return {"ok": True}


def leave_submit(db: Session, p: dict, user: Principal):
    sid = int(p.get("student_id") or 0)
    if not user.is_family or sid not in user.student_ids:
        raise HTTPException(403, "Anda hanya dapat mengajukan izin untuk anak/diri sendiri")
    start, end = parse_date(p.get("start_date")), parse_date(p.get("end_date"))
    if not start or not end or end < start:
        raise HTTPException(422, "Rentang tanggal tidak valid")
    if p.get("type") not in ("S", "I"):
        raise HTTPException(422, "Jenis harus S (sakit) atau I (izin)")
    reason = (p.get("reason") or "").strip()
    if not reason:
        raise HTTPException(422, "Alasan wajib diisi")
    row = LeaveRequest(student_id=sid, user_id=user.user.id, submitted_by=user.user.name, type=p["type"], start_date=start, end_date=end,
                       reason=reason, attachment_url=p.get("attachment_url") or "", status="menunggu", created_at=now())
    db.add(row)
    db.commit()
    return to_dict(row)


def leave_cancel(db: Session, p: dict, user: Principal):
    row = db.get(LeaveRequest, int(p.get("id") or 0))
    if not row or row.user_id != user.user.id:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if row.status != "menunggu":
        raise HTTPException(400, "Pengajuan yang sudah diproses tidak dapat dibatalkan")
    db.delete(row)
    db.commit()
    return {"ok": True}


def leave_review(db: Session, p: dict, user: Principal):
    row = db.get(LeaveRequest, int(p.get("id") or 0))
    if not row:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    st = db.get(Student, row.student_id)
    cls = db.get(SchoolClass, st.class_id) if st and st.class_id else None
    is_homeroom = user.role == "guru" and cls is not None and cls.homeroom_id == user.user.employee_id
    if not (is_homeroom or user.role in ("admin", "kesiswaan")):
        raise HTTPException(403, "Hanya wali kelas atau bagian kesiswaan yang dapat memproses")
    if row.status != "menunggu":
        raise HTTPException(400, "Pengajuan sudah diproses")
    status = p.get("status")
    if status not in ("disetujui", "ditolak"):
        raise HTTPException(422, "Status harus disetujui atau ditolak")
    row.status, row.review_note, row.reviewed_by, row.reviewed_at = status, p.get("note") or "", user.user.name, now()
    days = 0
    if status == "disetujui" and cls:
        note = f"{'Sakit' if row.type == 'S' else 'Izin'}: {row.reason} (pengajuan online)"
        d = row.start_date
        while d <= row.end_date:
            if d.weekday() < 5:
                att = db.scalars(select(StudentAttendance).where(StudentAttendance.student_id == st.id, StudentAttendance.date == d)).first()
                if att:
                    att.status, att.note = row.type, note
                else:
                    db.add(StudentAttendance(date=d, class_id=cls.id, student_id=st.id, status=row.type, note=note))
                days += 1
            d += dt.timedelta(days=1)
    db.commit()
    return {"ok": True, "days": days}


# ------------------------------------------------------------------ perpustakaan
LIB_STAFF = ("admin", "pustakawan")


def _settings(db: Session) -> Setting:
    return db.scalars(select(Setting)).first()


def _available(db: Session, book: Book) -> int:
    active = db.scalar(select(func.count(BookLoan.id)).where(BookLoan.book_id == book.id, BookLoan.returned_at.is_(None))) or 0
    return book.copies - active


def _late_days(loan: BookLoan) -> int:
    return max(0, ((loan.returned_at or today()) - loan.due_date).days)


def _create_fine_bill(db: Session, loan: BookLoan, amount: int) -> Bill:
    """Tagihan denda perpustakaan untuk peminjam siswa (tercatat di modul keuangan)."""
    fee = db.scalars(select(FeeType).where(FeeType.category == "denda")).first()
    if not fee:
        fee = FeeType(unit_id=None, name="Denda Perpustakaan", category="denda", amount=0, description="Denda keterlambatan pengembalian buku")
        db.add(fee)
        db.flush()
    book = db.get(Book, loan.book_id)
    bill = Bill(student_id=loan.student_id, applicant_id=None, fee_type_id=fee.id, period=f"{today():%Y-%m}", description=f"Denda perpustakaan: {book.title if book else 'buku'}",
                amount=amount, discount=0, paid_amount=0, due_date=today() + dt.timedelta(days=7), status="belum", created_at=now())
    db.add(bill)
    db.flush()
    loan.bill_id = bill.id
    return bill


def _sync_loan_fine(db: Session, bill: Bill) -> None:
    """Bila tagihan denda lunas, tandai denda pada peminjaman sebagai lunas."""
    if bill.status != "lunas":
        return
    db.flush()  # sesi tanpa autoflush: pastikan bill_id terbaru terlihat oleh query
    loan = db.scalars(select(BookLoan).where(BookLoan.bill_id == bill.id)).first()
    if loan and not loan.fine_paid:
        loan.fine_paid = True


def _credit_bill(bill: Bill, amount: int) -> None:
    bill.paid_amount += amount
    bill.status = "lunas" if bill.paid_amount >= bill.amount - bill.discount else "sebagian"


def apply_payment(db: Session, bill: Bill, amount: int, method: str, received_by: str, note: str = "", *, pending: bool = False, reference: str = "", proof_url: str = "") -> Payment:
    """Catat pembayaran. pending=True untuk pembayaran online (siswa/ortu/pendaftar): menunggu verifikasi keuangan."""
    pending_sum = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.bill_id == bill.id, Payment.status == "menunggu")) or 0
    remaining = bill.amount - bill.discount - bill.paid_amount - pending_sum
    if amount <= 0:
        raise HTTPException(400, "Nominal pembayaran tidak valid")
    if amount > remaining:
        msg = "Nominal melebihi sisa tagihan setelah pembayaran yang menunggu verifikasi" if pending_sum else "Nominal melebihi sisa tagihan"
        raise HTTPException(400, f"{msg} ({remaining:,})".replace(",", "."))
    pay = Payment(bill_id=bill.id, student_id=bill.student_id, applicant_id=bill.applicant_id, amount=amount, method=method,
                  receipt_no=None if pending else receipt_no(db), paid_at=now(), received_by=received_by, note=note or "",
                  status="menunggu" if pending else "terverifikasi", reference=reference or "", proof_url=proof_url or "",
                  verified_by="" if pending else received_by, verified_at=None if pending else now(), reject_reason="")
    db.add(pay)
    if not pending:
        _credit_bill(bill, amount)
    db.flush()
    return pay


def payments_verify(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "keuangan")
    pay = db.get(Payment, int(p.get("id") or 0))
    if not pay:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    if pay.status != "menunggu":
        raise HTTPException(400, "Pembayaran sudah diproses")
    bill = db.get(Bill, pay.bill_id)
    remaining = bill.amount - bill.discount - bill.paid_amount
    if pay.amount > remaining:
        raise HTTPException(400, "Nominal melebihi sisa tagihan; tolak dan minta pengajuan ulang")
    pay.status, pay.receipt_no, pay.verified_by, pay.verified_at = "terverifikasi", receipt_no(db), user.user.name, now()
    _credit_bill(bill, pay.amount)
    _sync_loan_fine(db, bill)
    db.commit()
    return to_dict(pay)


def payments_reject(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "keuangan")
    reason = (p.get("reason") or "").strip()
    if not reason:
        raise HTTPException(422, "Alasan penolakan wajib diisi")
    pay = db.get(Payment, int(p.get("id") or 0))
    if not pay:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    if pay.status != "menunggu":
        raise HTTPException(400, "Pembayaran sudah diproses")
    pay.status, pay.reject_reason, pay.verified_by, pay.verified_at = "ditolak", reason, user.user.name, now()
    db.commit()
    return to_dict(pay)


def library_borrow(db: Session, p: dict, user: Principal):
    ensure_role(user, *LIB_STAFF)
    cfg = _settings(db)
    book = db.get(Book, int(p.get("book_id") or 0))
    if not book:
        raise HTTPException(404, "Buku tidak ditemukan")
    if _available(db, book) <= 0:
        raise HTTPException(400, f'Semua eksemplar "{book.title}" sedang dipinjam')
    sid = int(p["student_id"]) if p.get("student_id") else None
    eid = int(p["employee_id"]) if p.get("employee_id") else None
    if bool(sid) == bool(eid):
        raise HTTPException(422, "Pilih satu peminjam (siswa atau pegawai)")
    if sid:
        st = db.get(Student, sid)
        if not st or st.status != "aktif":
            raise HTTPException(400, "Siswa tidak aktif")
        cond = BookLoan.student_id == sid
    else:
        emp = db.get(Employee, eid)
        if not emp or not emp.is_active:
            raise HTTPException(400, "Pegawai tidak aktif")
        cond = BookLoan.employee_id == eid
    mine = list(db.scalars(select(BookLoan).where(cond)))
    active = [l for l in mine if l.returned_at is None]
    if len(active) >= cfg.library_max_loans:
        raise HTTPException(400, f"Batas peminjaman {cfg.library_max_loans} buku sudah tercapai")
    if any(l.due_date < today() for l in active):
        raise HTTPException(400, "Peminjam masih memiliki buku yang terlambat dikembalikan")
    if any(l.fine > 0 and not l.fine_paid for l in mine):
        raise HTTPException(400, "Peminjam masih memiliki denda yang belum dibayar")
    if any(l.book_id == book.id for l in active):
        raise HTTPException(400, "Peminjam sedang meminjam buku yang sama")
    loan = BookLoan(book_id=book.id, student_id=sid, employee_id=eid, borrowed_at=today(), due_date=today() + dt.timedelta(days=cfg.library_loan_days),
                    returned_at=None, extended=False, fine=0, fine_paid=False, processed_by=user.user.name, notes=p.get("notes") or "")
    db.add(loan)
    resv = db.get(BookReservation, int(p["reservation_id"])) if p.get("reservation_id") else None
    if not resv:
        owner = (BookReservation.student_id == sid) if sid else (BookReservation.employee_id == eid)
        resv = db.scalars(select(BookReservation).where(BookReservation.book_id == book.id, BookReservation.status == "menunggu", owner)).first()
    if resv:
        resv.status = "dipinjam"
    db.commit()
    return to_dict(loan)


def library_return(db: Session, p: dict, user: Principal):
    ensure_role(user, *LIB_STAFF)
    loan = db.get(BookLoan, int(p.get("loan_id") or 0))
    if not loan:
        raise HTTPException(404, "Peminjaman tidak ditemukan")
    if loan.returned_at:
        raise HTTPException(400, "Buku sudah dikembalikan")
    days = _late_days(loan)
    loan.returned_at = today()
    loan.fine = days * _settings(db).library_fine_per_day
    loan.fine_paid = loan.fine == 0 or (bool(p.get("pay_fine")) and not loan.student_id)
    if loan.fine and loan.student_id:
        # Denda siswa masuk ke keuangan; bila dibayar di tempat langsung tercatat sebagai pembayaran
        bill = _create_fine_bill(db, loan, loan.fine)
        if p.get("pay_fine"):
            apply_payment(db, bill, loan.fine, "Tunai", user.user.name, "Denda perpustakaan (dibayar di perpustakaan)")
        _sync_loan_fine(db, bill)
    db.commit()
    return {**to_dict(loan), "late_days": days}


def library_extend(db: Session, p: dict, user: Principal):
    loan = db.get(BookLoan, int(p.get("loan_id") or 0))
    if not loan:
        raise HTTPException(404, "Peminjaman tidak ditemukan")
    own = (user.role == "siswa" and loan.student_id in user.student_ids) or (user.role == "guru" and loan.employee_id == user.user.employee_id)
    if not (own or user.role in LIB_STAFF):
        raise HTTPException(403, "Anda tidak dapat memperpanjang peminjaman ini")
    if loan.returned_at:
        raise HTTPException(400, "Buku sudah dikembalikan")
    if loan.extended:
        raise HTTPException(400, "Peminjaman hanya dapat diperpanjang satu kali")
    if loan.due_date < today():
        raise HTTPException(400, "Peminjaman sudah terlambat; kembalikan buku ke perpustakaan")
    if db.scalars(select(BookReservation).where(BookReservation.book_id == loan.book_id, BookReservation.status == "menunggu")).first():
        raise HTTPException(400, "Buku sedang direservasi peminjam lain")
    loan.due_date += dt.timedelta(days=_settings(db).library_loan_days)
    loan.extended = True
    db.commit()
    return to_dict(loan)


def library_pay_fine(db: Session, p: dict, user: Principal):
    ensure_role(user, *LIB_STAFF)
    loan = db.get(BookLoan, int(p.get("loan_id") or 0))
    if not loan or not loan.fine:
        raise HTTPException(400, "Tidak ada denda")
    if loan.fine_paid:
        raise HTTPException(400, "Denda sudah lunas")
    bill = db.get(Bill, loan.bill_id) if loan.bill_id else None
    if bill and bill.status != "lunas":
        apply_payment(db, bill, bill.amount - bill.discount - bill.paid_amount, "Tunai", user.user.name, "Denda perpustakaan (dibayar di perpustakaan)")
        _sync_loan_fine(db, bill)
    else:
        loan.fine_paid = True
    db.commit()
    return to_dict(loan)


def library_reserve(db: Session, p: dict, user: Principal):
    sid = next(iter(user.student_ids), None) if user.role == "siswa" else None
    eid = user.user.employee_id if user.role == "guru" else None
    if not sid and not eid:
        raise HTTPException(403, "Reservasi hanya untuk siswa dan guru")
    book = db.get(Book, int(p.get("book_id") or 0))
    if not book:
        raise HTTPException(404, "Buku tidak ditemukan")
    own_r = (BookReservation.student_id == sid) if sid else (BookReservation.employee_id == eid)
    mine = list(db.scalars(select(BookReservation).where(BookReservation.status == "menunggu", own_r)))
    if any(r.book_id == book.id for r in mine):
        raise HTTPException(400, "Anda sudah mereservasi buku ini")
    if len(mine) >= 3:
        raise HTTPException(400, "Maksimal 3 reservasi aktif")
    own_l = (BookLoan.student_id == sid) if sid else (BookLoan.employee_id == eid)
    if db.scalars(select(BookLoan).where(BookLoan.book_id == book.id, BookLoan.returned_at.is_(None), own_l)).first():
        raise HTTPException(400, "Anda sedang meminjam buku ini")
    r = BookReservation(book_id=book.id, student_id=sid, employee_id=eid, user_id=user.user.id, status="menunggu", created_at=now())
    db.add(r)
    db.commit()
    return to_dict(r)


def library_cancel_reservation(db: Session, p: dict, user: Principal):
    r = db.get(BookReservation, int(p.get("id") or 0))
    if not r:
        raise HTTPException(404, "Reservasi tidak ditemukan")
    own = (user.role == "siswa" and r.student_id in user.student_ids) or (user.role == "guru" and r.employee_id == user.user.employee_id)
    if not (own or user.role in LIB_STAFF):
        raise HTTPException(403, "Anda tidak dapat membatalkan reservasi ini")
    if r.status != "menunggu":
        raise HTTPException(400, "Reservasi sudah diproses")
    r.status = "batal"
    db.commit()
    return to_dict(r)


def library_settings(db: Session, p: dict, user: Principal):
    ensure_role(user, *LIB_STAFF)
    try:
        days, mx, fine = int(p["library_loan_days"]), int(p["library_max_loans"]), int(p["library_fine_per_day"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, "Nilai pengaturan tidak valid")
    if not (1 <= days <= 60 and 1 <= mx <= 20 and fine >= 0):
        raise HTTPException(422, "Nilai pengaturan tidak valid")
    cfg = _settings(db)
    cfg.library_loan_days, cfg.library_max_loans, cfg.library_fine_per_day = days, mx, fine
    db.commit()
    return to_dict(cfg)


# ------------------------------------------------------------------ kartu ujian
PROCTORS = ("admin", "kepsek", "kesiswaan", "guru")


def _card_meta(db: Session, st: Student) -> dict:
    cls = db.get(SchoolClass, st.class_id) if st.class_id else None
    mates = sorted(db.scalars(select(Student).where(Student.class_id == st.class_id, Student.status == "aktif")), key=lambda x: x.name) if cls else []
    seat = next((i + 1 for i, x in enumerate(mates) if x.id == st.id), 0)
    return {"class_name": cls.name if cls else "-", "room": cls.room if cls else "-", "seat": seat}


def examcard_get(db: Session, p: dict, user: Principal):
    period = db.get(ExamPeriod, int(p.get("period_id") or 0))
    st = db.get(Student, int(p.get("student_id") or 0))
    if not period or not st:
        raise HTTPException(404, "Data kartu ujian tidak ditemukan")
    if user.is_family and st.id not in user.student_ids:
        raise HTTPException(403, "Anda tidak dapat melihat kartu ujian ini")
    if not user.is_family:
        ensure_role(user, "admin", "kepsek", "keuangan", "kesiswaan", "guru")
    el = eligibility(db, period, st)
    return {
        **el, "dispensation": to_dict(el["dispensation"]) if el["dispensation"] else None, "period": to_dict(period), **_card_meta(db, st),
        "payload": card_payload(period.id, st) if el["eligible"] else None,
    }


def examcard_verify(db: Session, p: dict, user: Principal):
    ensure_role(user, *PROCTORS)
    period_id, nis, token_ok = int(p.get("period_id") or 0), (p.get("nis") or "").strip(), None
    if p.get("payload"):
        parsed = parse_payload(p["payload"])
        if not parsed:
            return {"valid": False, "reason": "QR tidak dikenali sebagai kartu ujian iSchool", "student": None}
        period_id, nis, token = parsed
        st_tok = db.scalars(select(Student).where(Student.nis == nis)).first()
        token_ok = bool(st_tok) and hmac.compare_digest(card_token(period_id, st_tok.id), token)
    period = db.get(ExamPeriod, period_id)
    st = db.scalars(select(Student).where(Student.nis == nis)).first() if nis else None
    if not period:
        return {"valid": False, "reason": "Periode ujian tidak ditemukan", "student": None}
    if not st:
        return {"valid": False, "reason": f"Siswa dengan NIS {nis or '-'} tidak ditemukan", "student": None}
    el = eligibility(db, period, st)
    meta = _card_meta(db, st)
    reason = ""
    if token_ok is False:
        reason = "Kode keamanan QR tidak cocok (kartu palsu/rusak)"
    elif not el["applicable"]:
        reason = "Siswa bukan peserta periode ujian ini"
    elif not el["eligible"]:
        reason = "Persyaratan administrasi belum terpenuhi"
    elif p.get("class_id") and st.class_id != int(p["class_id"]):
        reason = f"Bukan peserta kelas ini (terdaftar di {meta['class_name']})"
    valid = not reason
    start = dt.datetime.combine(today(), dt.time.min)
    already = db.scalars(select(ExamCheckin).where(ExamCheckin.period_id == period.id, ExamCheckin.student_id == st.id, ExamCheckin.valid, ExamCheckin.checked_at >= start)).first() is not None
    db.add(ExamCheckin(period_id=period.id, student_id=st.id, class_id=st.class_id, exam_id=None, valid=valid,
                       note=reason or ("Verifikasi manual (NIS)" if token_ok is None else "QR valid"), checked_by=user.user.name, checked_at=now()))
    db.commit()
    return {"valid": valid, "reason": reason, "already": already, "method": "manual" if token_ok is None else "qr",
            "student": {"id": st.id, "name": st.name, "nis": st.nis, "class_name": meta["class_name"], "gender": st.gender},
            "period": to_dict(period), "requirements": el["requirements"], "dispensation": to_dict(el["dispensation"]) if el["dispensation"] else None}


def examcard_dispense(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kepsek", "keuangan")
    reason = (p.get("reason") or "").strip()
    if not reason:
        raise HTTPException(422, "Alasan dispensasi wajib diisi")
    pid, sid = int(p.get("period_id") or 0), int(p.get("student_id") or 0)
    if not db.get(ExamPeriod, pid) or not db.get(Student, sid):
        raise HTTPException(404, "Data tidak ditemukan")
    if db.scalars(select(ExamDispensation).where(ExamDispensation.period_id == pid, ExamDispensation.student_id == sid)).first():
        raise HTTPException(400, "Dispensasi sudah diberikan")
    row = ExamDispensation(period_id=pid, student_id=sid, reason=reason, granted_by=user.user.name, created_at=now())
    db.add(row)
    db.commit()
    return to_dict(row)


def examcard_revoke(db: Session, p: dict, user: Principal):
    ensure_role(user, "admin", "kepsek", "keuangan")
    row = db.get(ExamDispensation, int(p.get("id") or 0))
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


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
    "exams.start": exams_start,
    "exams.saveAnswers": exams_save_answers,
    "exams.submit": exams_submit,
    "exams.gradeEssay": exams_grade_essay,
    "exams.windowCreate": exams_window_create,
    "exams.windowDelete": exams_window_delete,
    "grades.save": grades_save,
    "promotions.process": promotions_process,
    "academic_years.activate": academic_years_activate,
    "academic_years.archive": academic_years_archive,
    "ekskul.toggle": ekskul_toggle,
    "elearning.complete": elearning_complete,
    "elearning.join": elearning_join,
    "discussions.post": discussions_post,
    "discussions.delete": discussions_delete,
    "discussions.pin": discussions_pin,
    "import.run": import_run,
    "auth.changePassword": auth_change_password,
    "leave.submit": leave_submit,
    "leave.cancel": leave_cancel,
    "leave.review": leave_review,
    "payments.verify": payments_verify,
    "payments.reject": payments_reject,
    "library.borrow": library_borrow,
    "library.return": library_return,
    "library.extend": library_extend,
    "library.payFine": library_pay_fine,
    "library.reserve": library_reserve,
    "library.cancelReservation": library_cancel_reservation,
    "library.settings": library_settings,
    "examcard.get": examcard_get,
    "examcard.verify": examcard_verify,
    "examcard.dispense": examcard_dispense,
    "examcard.revokeDispensation": examcard_revoke,
}


@router.post("/{name}")
def run_action(name: str, payload: dict[str, Any] | None = None, db: Session = Depends(get_db), creds=Depends(bearer)):
    handler = HANDLERS.get(name)
    if not handler:
        raise HTTPException(404, f"Aksi '{name}' tidak dikenal")
    user = None if name in PUBLIC_ACTIONS else get_principal(creds, db)
    return handler(db, payload or {}, user)

