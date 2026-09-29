/** Penilaian soal (padanan server: backend/app/scoring.py). */
import type { AnswerValue, Question, QuestionType } from './types';

export const qType = (q: Question): QuestionType => q.type || 'pg';
export const qPoints = (q: Question) => (q.points && q.points > 0 ? q.points : qType(q) === 'esai' ? 10 : 1);

export const TYPE_LABEL: Record<QuestionType, string> = { pg: 'Pilihan Ganda', pgk: 'PG Kompleks', bs: 'Benar/Salah', esai: 'Esai' };

export function isAnswered(q: Question, a: AnswerValue | undefined) {
  const t = qType(q);
  if (t === 'pgk') return Array.isArray(a) && a.length > 0;
  if (t === 'esai') return typeof a === 'string' && a.trim().length > 0;
  return typeof a === 'number' && a >= 0;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

/** Poin otomatis untuk soal objektif; null untuk esai (dinilai guru). */
export function autoPoints(q: Question, a: AnswerValue | undefined): number | null {
  const t = qType(q);
  const pts = qPoints(q);
  if (t === 'esai') return null;
  if (t === 'pgk') return Array.isArray(a) && sameSet(a, q.answers || []) ? pts : 0;
  return typeof a === 'number' && a === q.answer ? pts : 0;
}

export interface ScoreResult {
  points: (number | null)[];
  score: number;
  correct: number;
  total: number;
  pending_essay: boolean;
}

/** Hitung nilai 0–100. essayPoints (opsional) = poin esai hasil koreksi guru per indeks soal. */
export function scoreAnswers(questions: Question[], answers: AnswerValue[], essayPoints: (number | null)[] = []): ScoreResult {
  const points = questions.map((q, i) => {
    if (qType(q) !== 'esai') return autoPoints(q, answers[i]);
    if (!isAnswered(q, answers[i])) return 0; // esai kosong otomatis 0
    const p = essayPoints[i];
    return typeof p === 'number' ? Math.max(0, Math.min(qPoints(q), p)) : null;
  });
  const max = questions.reduce((a, q) => a + qPoints(q), 0);
  const earned = points.reduce<number>((a, p) => a + (p ?? 0), 0);
  const correct = questions.filter((q, i) => qType(q) !== 'esai' && points[i] === qPoints(q)).length;
  return { points, score: max ? Math.round((earned / max) * 100) : 0, correct, total: questions.length, pending_essay: points.some((p) => p === null) };
}

/** Soal tanpa kunci jawaban (untuk siswa). */
export const publicQuestion = (q: Question): Question => ({ type: qType(q), q: q.q, options: q.options, answer: -1, points: qPoints(q) });

export function emptyAnswer(q: Question): AnswerValue {
  const t = qType(q);
  return t === 'pgk' ? [] : t === 'esai' ? '' : -1;
}

export function validateQuestion(q: Question, i: number): string | null {
  const t = qType(q);
  const n = `Soal ${i + 1}`;
  if (!q.q.trim()) return `${n}: pertanyaan kosong`;
  if (q.points !== undefined && !(q.points > 0)) return `${n}: bobot harus lebih dari 0`;
  if (t === 'esai') return null;
  if (t === 'bs') return q.answer === 0 || q.answer === 1 ? null : `${n}: pilih Benar atau Salah sebagai kunci`;
  if (q.options.length < 2 || q.options.some((o) => !o.trim())) return `${n}: lengkapi semua pilihan jawaban`;
  if (t === 'pgk') return (q.answers || []).length >= 1 && (q.answers || []).every((x) => x >= 0 && x < q.options.length) ? null : `${n}: tandai minimal satu kunci jawaban`;
  return q.answer >= 0 && q.answer < q.options.length ? null : `${n}: tandai kunci jawaban`;
}
