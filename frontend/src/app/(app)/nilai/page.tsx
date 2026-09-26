'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, History, Printer, Save } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useLearningScope, type LearningScope } from '@/lib/useLearningScope';
import { Avatar, Button, Card, Input, Loading, PageHeader, Select, Tabs, run } from '@/components/ui';
import { ReportCard } from '@/components/ReportCard';
import { avg, cn, computeFinal, downloadCSV, predicate, round } from '@/lib/utils';
import { studentSemesters, semesterLabel } from '@/lib/history';
import type { Student } from '@/lib/types';

type Row = { assignment: string; daily: string; midterm: string; final_exam: string };
const num = (v: string) => (v === '' ? null : Number(v));

export default function NilaiPage() {
  const scope = useLearningScope();
  if (!scope) return <Loading />;
  if (scope.student) return <FamilyReport scope={scope} />;
  return <StaffGrades scope={scope} />;
}

/** Pilihan semester rapor (semester aktif + semester-semester sebelumnya). */
function SemesterSelect({ student, value, onChange }: { student: Student; value: number | null; onChange: (id: number) => void }) {
  const { data } = useData(['academic_years', 'enrollments', 'grades', 'classes', 'employees', 'subjects', 'student_attendance']);
  const semesters = useMemo(() => (data ? studentSemesters(data, student) : []), [data, student]);
  useEffect(() => {
    if (semesters.length && !semesters.some((s) => s.ay.id === value)) onChange(semesters[semesters.length - 1].ay.id);
  }, [semesters, value, onChange]);
  return <Select className="w-64" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} options={[...semesters].reverse().map((s) => ({ value: s.ay.id, label: `${semesterLabel(s.ay)} · Kelas ${s.className}${s.isCurrent ? ' (berjalan)' : ''}` }))} />;
}

function FamilyReport({ scope }: { scope: LearningScope }) {
  const student = scope.student!;
  const [ayId, setAyId] = useState<number | null>(null);
  return (
    <>
      <PageHeader title="Nilai & Rapor" subtitle={student.name} actions={<>
        <SemesterSelect student={student} value={ayId} onChange={setAyId} />
        <Link href="/riwayat/"><Button variant="secondary"><History className="h-4 w-4" /> Riwayat Akademik</Button></Link>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak Rapor</Button>
      </>} />
      {ayId && <ReportCard student={student} academicYearId={ayId} />}
    </>
  );
}

function StaffGrades({ scope }: { scope: LearningScope }) {
  const { data } = useData(['grades', 'academic_years']);
  const isHomeroom = scope.classList.some((c) => c.homeroom_id === scope.employee?.id);
  const [tab, setTab] = useState<'input' | 'leger' | 'rapor'>(scope.canManage ? 'input' : 'leger');
  const [classId, setClassId] = useState(0);
  const [subjectId, setSubjectId] = useState(0);
  const [studentId, setStudentId] = useState(0);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [raporAy, setRaporAy] = useState<number | null>(null);

  // Untuk leger & rapor: guru hanya kelas perwalian; staf semua kelas pada scope
  const legerClasses = scope.role === 'guru' ? scope.classList.filter((c) => c.homeroom_id === scope.employee?.id) : scope.classList;
  const classOpts = tab === 'input' ? scope.classList : legerClasses;

  useEffect(() => {
    if (!classOpts.some((c) => c.id === classId)) setClassId(classOpts[0]?.id || 0);
  }, [classOpts, classId]);
  const subjectOpts = useMemo(() => [...new Set(scope.pairs.filter((p) => p.class_id === classId).map((p) => p.subject_id))], [scope.pairs, classId]);
  useEffect(() => {
    if (!subjectOpts.includes(subjectId)) setSubjectId(subjectOpts[0] || 0);
  }, [subjectOpts, subjectId]);

  const students = useMemo(() => scope.students.filter((s) => s.class_id === classId && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name)), [scope.students, classId]);
  useEffect(() => {
    if (!students.some((s) => s.id === studentId)) setStudentId(students[0]?.id || 0);
  }, [students, studentId]);

  const ay = data?.academic_years.find((y) => y.is_active);
  useEffect(() => {
    if (!data || !ay) return;
    const m: Record<number, Row> = {};
    students.forEach((s) => {
      const g = data.grades.find((x) => x.student_id === s.id && x.subject_id === subjectId && x.academic_year_id === ay.id);
      m[s.id] = { assignment: g?.assignment?.toString() ?? '', daily: g?.daily?.toString() ?? '', midterm: g?.midterm?.toString() ?? '', final_exam: g?.final_exam?.toString() ?? '' };
    });
    setRows(m);
  }, [data, students, subjectId, ay]);

  if (!data || !ay) return <Loading />;
  const kkm = scope.subjects.get(subjectId)?.kkm || 75;
  const canInput = scope.canManage && scope.pairAllowed(classId, subjectId);

  const save = () => run(() => api.action('grades.save', { rows: students.map((s) => ({ student_id: s.id, subject_id: subjectId, academic_year_id: ay.id, assignment: num(rows[s.id]?.assignment), daily: num(rows[s.id]?.daily), midterm: num(rows[s.id]?.midterm), final_exam: num(rows[s.id]?.final_exam) })) }), 'Nilai disimpan');

  const legerSubjects = [...new Set(scope.pairs.filter((p) => p.class_id === classId).map((p) => p.subject_id))];
  const tabs = [
    ...(scope.canManage ? [{ value: 'input' as const, label: 'Input Nilai' }] : []),
    ...(legerClasses.length ? [{ value: 'leger' as const, label: 'Leger Kelas' }, { value: 'rapor' as const, label: 'Rapor Siswa' }] : []),
  ];

  return (
    <>
      <PageHeader title="Nilai & Rapor" subtitle={`Tahun ajaran ${ay.name} semester ${ay.semester} · Nilai akhir = 30% tugas + 20% harian + 20% PTS + 30% PAS`} />
      {tabs.length > 1 && <Tabs value={tab} onChange={setTab} tabs={tabs} />}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Select className="w-48" value={classId} onChange={(e) => setClassId(Number(e.target.value))} options={classOpts.map((c) => ({ value: c.id, label: c.name }))} />
        {tab === 'input' && <Select className="w-64" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} options={subjectOpts.map((id) => ({ value: id, label: scope.subjects.get(id)?.name || '' }))} />}
        {tab === 'rapor' && <Select className="w-64" value={studentId} onChange={(e) => setStudentId(Number(e.target.value))} options={students.map((s) => ({ value: s.id, label: s.name }))} />}
        {tab === 'rapor' && students.find((s) => s.id === studentId) && <SemesterSelect student={students.find((s) => s.id === studentId)!} value={raporAy} onChange={setRaporAy} />}
        {tab === 'rapor' && <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>}
        {isHomeroom && tab === 'input' && <span className="self-center text-xs text-slate-500">Anda wali kelas — leger & rapor tersedia di tab lain.</span>}
      </div>

      {tab === 'input' && (
        <Card title={`${scope.subjects.get(subjectId)?.name || ''} · ${scope.classes.get(classId)?.name || ''} · KKTP ${kkm}`} actions={canInput && <Button size="sm" onClick={save}><Save className="h-4 w-4" /> Simpan Nilai</Button>} bodyClass="p-0 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Siswa</th><th className="w-24">Tugas</th><th className="w-24">Harian</th><th className="w-24">PTS</th><th className="w-24">PAS</th><th className="w-20 text-center">Akhir</th><th className="w-16 text-center">Predikat</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const r = rows[s.id] || { assignment: '', daily: '', midterm: '', final_exam: '' };
                const final = computeFinal({ assignment: num(r.assignment), daily: num(r.daily), midterm: num(r.midterm), final_exam: num(r.final_exam) });
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-4 py-1.5"><span className="flex items-center gap-2"><Avatar name={s.name} className="h-7 w-7 text-[10px]" />{s.name}</span></td>
                    {(['assignment', 'daily', 'midterm', 'final_exam'] as const).map((k) => (
                      <td key={k} className="py-1.5 pr-2"><Input type="number" min={0} max={100} disabled={!canInput} value={r[k]} onChange={(e) => setRows({ ...rows, [s.id]: { ...r, [k]: e.target.value } })} className="py-1.5" /></td>
                    ))}
                    <td className={cn('text-center font-bold', final !== null && final < kkm ? 'text-red-600' : 'text-slate-800')}>{final ?? '-'}</td>
                    <td className="text-center">{predicate(final)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'leger' && (
        <Card title={`Leger Nilai ${scope.classes.get(classId)?.name || ''}`} bodyClass="p-0 overflow-x-auto" actions={<Button size="sm" variant="secondary" onClick={() => downloadCSV(`leger-${scope.classes.get(classId)?.name}.csv`, [['NIS', 'Nama', ...legerSubjects.map((id) => scope.subjects.get(id)?.code || ''), 'Rata-rata'], ...students.map((s) => { const v = legerSubjects.map((id) => data.grades.find((g) => g.student_id === s.id && g.subject_id === id && g.academic_year_id === ay.id)?.final ?? null); return [s.nis, s.name, ...v, round(avg(v), 2)]; })])}><Download className="h-4 w-4" /> CSV</Button>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2 text-left">No</th><th className="text-left">Nama</th>
                {legerSubjects.map((id) => <th key={id} className="px-2" title={scope.subjects.get(id)?.name}>{scope.subjects.get(id)?.code}</th>)}
                <th className="px-2">Rata²</th><th className="px-3">Rank</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const table = students.map((s) => {
                  const v = legerSubjects.map((id) => data.grades.find((g) => g.student_id === s.id && g.subject_id === id && g.academic_year_id === ay.id)?.final ?? null);
                  return { s, v, mean: avg(v) };
                });
                const ranked = [...table].sort((a, b) => (b.mean || 0) - (a.mean || 0)).map((x) => x.s.id);
                return table.map(({ s, v, mean }, i) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{i + 1}</td><td className="whitespace-nowrap">{s.name}</td>
                    {v.map((x, j) => <td key={j} className={cn('px-2 text-center', x !== null && x < (scope.subjects.get(legerSubjects[j])?.kkm || 75) && 'font-semibold text-red-600')}>{x ?? '-'}</td>)}
                    <td className="px-2 text-center font-bold">{round(mean, 1) ?? '-'}</td>
                    <td className="px-3 text-center">{ranked.indexOf(s.id) + 1}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'rapor' && studentId > 0 && raporAy && <ReportCard student={students.find((s) => s.id === studentId)!} academicYearId={raporAy} />}
    </>
  );
}
