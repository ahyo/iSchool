"""Penilaian soal (padanan frontend/src/lib/scoring.ts).

Tipe soal: pg (satu kunci `answer`), pgk (beberapa kunci `answers`), bs (benar/salah, `answer` 0/1),
esai (jawaban teks, dinilai guru; `key` = kunci/rubrik).
"""
from typing import Any


def q_type(q: dict) -> str:
    return q.get("type") or "pg"


def q_points(q: dict) -> float:
    p = q.get("points")
    if isinstance(p, (int, float)) and p > 0:
        return p
    return 10 if q_type(q) == "esai" else 1


def is_answered(q: dict, a: Any) -> bool:
    t = q_type(q)
    if t == "pgk":
        return isinstance(a, list) and len(a) > 0
    if t == "esai":
        return isinstance(a, str) and a.strip() != ""
    return isinstance(a, int) and not isinstance(a, bool) and a >= 0


def auto_points(q: dict, a: Any) -> float | None:
    t, pts = q_type(q), q_points(q)
    if t == "esai":
        return None
    if t == "pgk":
        return pts if isinstance(a, list) and sorted(set(a)) == sorted(set(q.get("answers") or [])) and len(a) == len(set(a)) else 0
    return pts if isinstance(a, int) and not isinstance(a, bool) and a == q.get("answer") else 0


def score_answers(questions: list[dict], answers: list, essay_points: list | None = None) -> dict:
    essay_points = essay_points or []
    points: list[float | None] = []
    for i, q in enumerate(questions):
        a = answers[i] if i < len(answers) else None
        if q_type(q) != "esai":
            points.append(auto_points(q, a))
        elif not is_answered(q, a):
            points.append(0)  # esai kosong otomatis 0
        else:
            p = essay_points[i] if i < len(essay_points) else None
            points.append(max(0, min(q_points(q), p)) if isinstance(p, (int, float)) else None)
    total_max = sum(q_points(q) for q in questions)
    earned = sum(p or 0 for p in points)
    correct = sum(1 for i, q in enumerate(questions) if q_type(q) != "esai" and points[i] == q_points(q))
    return {"points": points, "score": round(earned / total_max * 100) if total_max else 0, "correct": correct,
            "total": len(questions), "pending_essay": any(p is None for p in points)}


def empty_answer(q: dict):
    t = q_type(q)
    return [] if t == "pgk" else "" if t == "esai" else -1


def public_question(q: dict) -> dict:
    """Soal tanpa kunci jawaban/rubrik (untuk siswa & orang tua)."""
    return {"type": q_type(q), "q": q.get("q"), "options": q.get("options") or [], "answer": -1, "points": q_points(q)}
