import type { AcademicYear, DB, Enrollment, Student } from './types';
import { avg, round } from './utils';

export interface SemesterRecord {
  ay: AcademicYear;
  enrollment?: Enrollment;
  className: string;
  homeroomName: string;
  grade: number | null;
  mean: number | null;
  subjects: number;
  below: number;
  absences: { S: number; I: number; A: number };
  isCurrent: boolean;
}

/** Semua semester yang pernah dijalani siswa (arsip + semester aktif), urut kronologis. */
export function studentSemesters(
  data: Pick<DB, 'academic_years' | 'enrollments' | 'grades' | 'classes' | 'employees' | 'subjects' | 'student_attendance'>,
  student: Student,
): SemesterRecord[] {
  const kkm = new Map(data.subjects.map((s) => [s.id, s.kkm]));
  const ayIds = new Set<number>([
    ...data.enrollments.filter((e) => e.student_id === student.id).map((e) => e.academic_year_id),
    ...data.grades.filter((g) => g.student_id === student.id).map((g) => g.academic_year_id),
  ]);
  const active = data.academic_years.find((y) => y.is_active);
  if (active && student.status === 'aktif') ayIds.add(active.id);
  return data.academic_years
    .filter((y) => ayIds.has(y.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((ay) => {
      const enrollment = data.enrollments.find((e) => e.student_id === student.id && e.academic_year_id === ay.id);
      const grades = data.grades.filter((g) => g.student_id === student.id && g.academic_year_id === ay.id);
      const isCurrent = ay.is_active && student.status === 'aktif';
      const cls = isCurrent ? data.classes.find((c) => c.id === student.class_id) : undefined;
      const att = enrollment ? null : data.student_attendance.filter((a) => a.student_id === student.id && a.date >= ay.start_date && a.date <= ay.end_date);
      return {
        ay,
        enrollment,
        className: enrollment?.class_name ?? cls?.name ?? '-',
        homeroomName: enrollment?.homeroom_name ?? data.employees.find((e) => e.id === cls?.homeroom_id)?.name ?? '-',
        grade: enrollment?.grade ?? cls?.grade ?? null,
        mean: round(avg(grades.map((g) => g.final)), 1),
        subjects: grades.length,
        below: grades.filter((g) => g.final !== null && g.final < (kkm.get(g.subject_id) || 75)).length,
        absences: enrollment ? { S: enrollment.sick, I: enrollment.permit, A: enrollment.absent } : { S: att!.filter((a) => a.status === 'S').length, I: att!.filter((a) => a.status === 'I').length, A: att!.filter((a) => a.status === 'A').length },
        isCurrent,
      };
    });
}

export const semesterLabel = (ay: AcademicYear) => `${ay.name} ${ay.semester}`;
