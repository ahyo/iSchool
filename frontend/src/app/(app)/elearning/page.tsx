'use client';
import { useEffect, useState } from 'react';
import { useData } from '@/lib/api';
import { useLearningScope } from '@/lib/useLearningScope';
import { Loading, PageHeader } from '@/components/ui';
import { CourseCatalog, CourseView, courseKey, type Course, type CourseTab } from '@/components/elearning';

/** Pusat e-learning: katalog kelas online -> kursus (pelajaran, kelas virtual, diskusi, progres). */
export default function ELearningPage() {
  const scope = useLearningScope();
  const { data } = useData(['lessons', 'lesson_progress', 'virtual_classes', 'discussions']);
  const [course, setCourse] = useState<Course | null>(null);
  const [tab, setTab] = useState<CourseTab | undefined>();

  // Simpan kursus terbuka di URL (?c=kelas-mapel) agar bisa di-refresh / dibagikan
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    const [class_id, subject_id] = (c || '').split('-').map(Number);
    if (class_id && subject_id) setCourse({ class_id, subject_id });
  }, []);
  const open = (c: Course | null, t?: CourseTab) => {
    setCourse(c);
    setTab(t);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set('c', courseKey(c));
    else url.searchParams.delete('c');
    window.history.replaceState(null, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  if (!scope || !data) return <Loading />;
  const valid = course && scope.pairAllowed(course.class_id, course.subject_id);
  const subtitle = scope.student
    ? `${scope.role === 'ortu' ? 'Pantau belajar online' : 'Kelas online'} ${scope.student.name}`
    : 'Kelas online: pelajaran bertahap, kuis, kelas virtual, forum diskusi, dan pelacakan progres';
  return (
    <>
      <PageHeader title="E-Learning" subtitle={subtitle} />
      {valid ? <CourseView key={courseKey(course)} scope={scope} data={data} course={course} initialTab={tab} onBack={() => open(null)} /> : <CourseCatalog scope={scope} data={data} onOpen={open} />}
    </>
  );
}
