"""Kartu ujian: kelayakan (SPP & biaya ujian) dan token QR bertanda tangan HMAC.

Padanan logika kelayakan dari frontend/src/lib/examcard.ts.
"""
import hashlib
import hmac
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Bill, ExamDispensation, ExamPeriod, FeeType, Student

QR_PREFIX = "ISCHOOL-KU"
MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def period_label(p: str) -> str:
    y, m = p.split("-")
    return f"{MONTHS[int(m) - 1]} {y}"


def card_token(period_id: int, student_id: int) -> str:
    msg = f"exam-card:{period_id}:{student_id}".encode()
    return hmac.new(get_settings().secret_key.encode(), msg, hashlib.sha256).hexdigest()[:16]


def card_payload(period_id: int, student: Student) -> str:
    return f"{QR_PREFIX}:{period_id}:{student.nis}:{card_token(period_id, student.id)}"


def parse_payload(text: str) -> tuple[int, str, str] | None:
    m = re.match(r"^ISCHOOL-KU:(\d+):([^:]+):([a-f0-9]+)$", (text or "").strip(), re.I)
    return (int(m[1]), m[2], m[3].lower()) if m else None


def eligibility(db: Session, period: ExamPeriod, student: Student) -> dict:
    applicable = student.status == "aktif" and (not period.unit_id or period.unit_id == student.unit_id)
    bills = list(db.scalars(select(Bill).where(Bill.student_id == student.id)))
    remaining = lambda b: b.amount - b.discount - b.paid_amount  # noqa: E731
    reqs = []
    if period.spp_until:
        spp_ids = set(db.scalars(select(FeeType.id).where(FeeType.category == "bulanan")))
        unpaid = [b for b in bills if b.fee_type_id in spp_ids and b.period <= period.spp_until and b.status != "lunas"]
        reqs.append({"key": "spp", "label": f"SPP lunas s.d. {period_label(period.spp_until)}", "ok": not unpaid,
                     "detail": ("Belum lunas: " + ", ".join(period_label(b.period) for b in unpaid)) if unpaid else "Lunas",
                     "outstanding": sum(remaining(b) for b in unpaid)})
    for fid in period.required_fee_type_ids or []:
        fee = db.get(FeeType, fid)
        if not fee or (fee.unit_id and fee.unit_id != student.unit_id):
            continue
        fb = [b for b in bills if b.fee_type_id == fid]
        unpaid = [b for b in fb if b.status != "lunas"]
        reqs.append({"key": f"fee-{fid}", "label": fee.name, "ok": not unpaid,
                     "detail": "Belum ditagihkan" if not fb else "Belum lunas" if unpaid else "Lunas",
                     "outstanding": sum(remaining(b) for b in unpaid)})
    disp = db.scalars(select(ExamDispensation).where(ExamDispensation.period_id == period.id, ExamDispensation.student_id == student.id)).first()
    return {"applicable": applicable, "eligible": applicable and (disp is not None or all(r["ok"] for r in reqs)), "requirements": reqs, "dispensation": disp}


def period_for_exam(db: Session, exam_type: str, date, unit_id: int) -> ExamPeriod | None:
    for p in db.scalars(select(ExamPeriod).where(ExamPeriod.is_active, ExamPeriod.type == exam_type, ExamPeriod.start_date <= date, ExamPeriod.end_date >= date)):
        if not p.unit_id or p.unit_id == unit_id:
            return p
    return None
