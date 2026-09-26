import type { Schedule, SchoolClass, Student } from './types';

export function indexBy<T extends { id: number }>(rows: T[] | undefined): Map<number, T> {
  return new Map((rows || []).map((r) => [r.id, r]));
}

/** Kelas yang diajar / diwalikan oleh seorang guru. */
export function teacherClassIds(employeeId: number | undefined, schedules: Schedule[], classes: SchoolClass[]): Set<number> {
  const ids = new Set<number>();
  if (!employeeId) return ids;
  schedules.filter((s) => s.teacher_id === employeeId).forEach((s) => ids.add(s.class_id));
  classes.filter((c) => c.homeroom_id === employeeId).forEach((c) => ids.add(c.id));
  return ids;
}

/** Pasangan (kelas, mapel) yang diajar seorang guru. */
export function teacherPairs(employeeId: number | undefined, schedules: Schedule[]) {
  const seen = new Set<string>();
  const out: { class_id: number; subject_id: number }[] = [];
  schedules
    .filter((s) => s.teacher_id === employeeId)
    .forEach((s) => {
      const k = `${s.class_id}-${s.subject_id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ class_id: s.class_id, subject_id: s.subject_id });
      }
    });
  return out;
}

export const byUnit = <T extends { unit_id: number | null }>(rows: T[], unitId: number) => (unitId ? rows.filter((r) => r.unit_id === unitId || r.unit_id === null) : rows);
export const strictUnit = <T extends { unit_id: number | null }>(rows: T[], unitId: number) => (unitId ? rows.filter((r) => r.unit_id === unitId) : rows);

export const activeStudents = (students: Student[]) => students.filter((s) => s.status === 'aktif');

export function sortClasses(a: SchoolClass, b: SchoolClass) {
  return a.unit_id - b.unit_id || a.grade - b.grade || a.name.localeCompare(b.name);
}
