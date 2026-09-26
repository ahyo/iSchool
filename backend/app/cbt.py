"""Aturan jadwal & sesi CBT (padanan frontend/src/lib/cbt.ts)."""
import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Exam, ExamAttempt, ExamResult, ExamWindow

GRACE = dt.timedelta(seconds=60)  # toleransi jaringan setelah batas waktu


def at(date: dt.date, hhmm: str) -> dt.datetime:
    h, m = map(int, hhmm.split(":"))
    return dt.datetime.combine(date, dt.time(h, m))


def exam_end(exam: Exam) -> str:
    if exam.end_time:
        return exam.end_time
    h, m = map(int, exam.start_time.split(":"))
    t = min(23 * 60 + 59, h * 60 + m + exam.duration)
    return f"{t // 60:02d}:{t % 60:02d}"


def sessions_for(db: Session, exam: Exam, student_id: int) -> list[dict]:
    out = [{"kind": "utama", "window_id": None, "date": exam.date, "start_time": exam.start_time, "end_time": exam_end(exam)}]
    for w in db.scalars(select(ExamWindow).where(ExamWindow.exam_id == exam.id)):
        if student_id in (w.student_ids or []):
            out.append({"kind": w.kind, "window_id": w.id, "date": w.date, "start_time": w.start_time, "end_time": w.end_time})
    return out


def effective_score(results: list[ExamResult], kkm: float) -> float | None:
    main = next((r for r in results if r.kind != "remedial"), None)
    rem = next((r for r in results if r.kind == "remedial"), None)
    if not main:
        return min(rem.score, kkm) if rem else None
    return max(main.score, min(rem.score, kkm)) if rem else main.score


def availability(db: Session, exam: Exam, student_id: int, kkm: float, now: dt.datetime) -> dict:
    mine = list(db.scalars(select(ExamResult).where(ExamResult.exam_id == exam.id, ExamResult.student_id == student_id)))
    has_main = any(r.kind != "remedial" for r in mine)
    has_rem = any(r.kind == "remedial" for r in mine)
    open_attempt = db.scalars(select(ExamAttempt).where(ExamAttempt.exam_id == exam.id, ExamAttempt.student_id == student_id, ExamAttempt.submitted_at.is_(None))).first()
    sessions = sessions_for(db, exam, student_id)
    if open_attempt and open_attempt.deadline > now:
        s = next((x for x in sessions if x["kind"] == open_attempt.kind and x["window_id"] == open_attempt.window_id), None)
        if s:
            return {"state": "resume", "attempt": open_attempt, "session": s}

    def eligible(s: dict) -> bool:
        if s["kind"] == "remedial":
            main_score = effective_score([r for r in mine if r.kind != "remedial"], kkm)
            return has_main and not has_rem and (main_score or 0) < kkm
        return not has_main

    cands = [s for s in sessions if eligible(s)]
    current = next((s for s in cands if at(s["date"], s["start_time"]) <= now < at(s["date"], s["end_time"])), None)
    if current:
        return {"state": "open", "session": current}
    upcoming = sorted((s for s in cands if at(s["date"], s["start_time"]) > now), key=lambda s: at(s["date"], s["start_time"]))
    if upcoming:
        return {"state": "upcoming", "session": upcoming[0]}
    if has_main:
        return {"state": "done"}
    return {"state": "closed", "reason": "Ujian sudah ditutup. Hubungi guru untuk jadwal susulan."}
