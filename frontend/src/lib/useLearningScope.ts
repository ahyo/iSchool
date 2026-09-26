'use client';
import { useMemo } from 'react';
import { useData } from './api';
import { useAuth, useProfile, useWorkspace } from './auth';
import { indexBy, sortClasses, teacherPairs } from './scope';

/** Menentukan kelas & mapel yang relevan untuk user login (guru, siswa, ortu, staf). */
export function useLearningScope() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee, student, loaded } = useProfile();
  const { data } = useData(['classes', 'subjects', 'schedules', 'employees', 'students']);

  return useMemo(() => {
    if (!data || !user || !loaded) return null;
    const role = user.role;
    const classes = indexBy(data.classes);
    const subjects = indexBy(data.subjects);
    const employees = indexBy(data.employees);
    let pairs: { class_id: number; subject_id: number }[] = [];
    if (role === 'guru') pairs = teacherPairs(employee?.id, data.schedules);
    else if (student) {
      const seen = new Set<number>();
      data.schedules.filter((s) => s.class_id === student.class_id).forEach((s) => {
        if (!seen.has(s.subject_id)) { seen.add(s.subject_id); pairs.push({ class_id: s.class_id, subject_id: s.subject_id }); }
      });
    } else {
      const seen = new Set<string>();
      data.schedules.forEach((s) => {
        const c = classes.get(s.class_id);
        if (unitId && c?.unit_id !== unitId) return;
        const k = `${s.class_id}-${s.subject_id}`;
        if (!seen.has(k)) { seen.add(k); pairs.push({ class_id: s.class_id, subject_id: s.subject_id }); }
      });
    }
    const classIds = [...new Set(pairs.map((p) => p.class_id))];
    const classList = classIds.map((id) => classes.get(id)!).filter(Boolean).sort(sortClasses);
    const isTeacher = role === 'guru';
    const canManage = role === 'guru' || role === 'admin';
    const pairAllowed = (classId: number, subjectId: number) => pairs.some((p) => p.class_id === classId && p.subject_id === subjectId);
    return { role, employee, student, pairs, classList, classes, subjects, employees, isTeacher, canManage, pairAllowed, students: data.students };
  }, [data, user, employee, student, unitId, loaded]);
}

export type LearningScope = NonNullable<ReturnType<typeof useLearningScope>>;
