/** Aturan jadwal & sesi CBT (dipakai UI, aksi demo, dan dicerminkan di backend). */
import type { AttemptKind, Exam, ExamAttempt, ExamResult, ExamWindow } from './types';

export const at = (date: string, time: string) => new Date(`${date}T${time}:00`);

export function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const examEnd = (e: Pick<Exam, 'start_time' | 'end_time' | 'duration'>) => e.end_time || addMinutes(e.start_time, e.duration);

export interface Session {
  kind: AttemptKind;
  window_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
}

/** Semua sesi (utama + susulan/remedial) yang berlaku untuk seorang siswa. */
export function sessionsFor(exam: Exam, windows: ExamWindow[], studentId: number): Session[] {
  const list: Session[] = [{ kind: 'utama', window_id: null, date: exam.date, start_time: exam.start_time, end_time: examEnd(exam) }];
  windows.filter((w) => w.exam_id === exam.id && w.student_ids.includes(studentId))
    .forEach((w) => list.push({ kind: w.kind, window_id: w.id, date: w.date, start_time: w.start_time, end_time: w.end_time }));
  return list;
}

/** Nilai efektif: nilai utama/susulan; remedial dihitung maks. KKTP dan dipakai bila lebih tinggi. */
export function effectiveScore(results: ExamResult[], kkm: number) {
  const main = results.find((r) => r.kind !== 'remedial');
  const rem = results.find((r) => r.kind === 'remedial');
  if (!main) return rem ? Math.min(rem.score, kkm) : null;
  return rem ? Math.max(main.score, Math.min(rem.score, kkm)) : main.score;
}

export type Availability =
  | { state: 'resume'; attempt: ExamAttempt; session: Session }
  | { state: 'open'; session: Session }
  | { state: 'upcoming'; session: Session }
  | { state: 'done' }
  | { state: 'closed'; reason: string };

/** Status ujian bagi siswa pada waktu `now`. */
export function availability(exam: Exam, windows: ExamWindow[], results: ExamResult[], attempts: ExamAttempt[], studentId: number, kkm: number, now: Date): Availability {
  const mine = results.filter((r) => r.exam_id === exam.id && r.student_id === studentId);
  const hasMain = mine.some((r) => r.kind !== 'remedial');
  const hasRemedial = mine.some((r) => r.kind === 'remedial');
  const open = attempts.find((a) => a.exam_id === exam.id && a.student_id === studentId && !a.submitted_at);
  if (open && new Date(open.deadline) > now) {
    const s = sessionsFor(exam, windows, studentId).find((x) => x.kind === open.kind && x.window_id === open.window_id);
    if (s) return { state: 'resume', attempt: open, session: s };
  }
  const eligible = (s: Session) => (s.kind === 'remedial' ? hasMain && !hasRemedial && (effectiveScore(mine.filter((r) => r.kind !== 'remedial'), kkm) ?? 0) < kkm : !hasMain);
  const sessions = sessionsFor(exam, windows, studentId).filter(eligible);
  const current = sessions.find((s) => at(s.date, s.start_time) <= now && now < at(s.date, s.end_time));
  if (current) return { state: 'open', session: current };
  const next = sessions.filter((s) => at(s.date, s.start_time) > now).sort((a, b) => at(a.date, a.start_time).getTime() - at(b.date, b.start_time).getTime())[0];
  if (next) return { state: 'upcoming', session: next };
  if (hasMain) return { state: 'done' };
  return { state: 'closed', reason: 'Ujian sudah ditutup. Hubungi guru untuk jadwal susulan.' };
}

export const KIND_LABEL: Record<AttemptKind, string> = { utama: 'Utama', susulan: 'Susulan', remedial: 'Remedial' };
