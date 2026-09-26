'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Award, CalendarRange, FileText, GraduationCap, Printer, School } from 'lucide-react';
import { useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Empty, Loading, PageHeader, SearchInput, StatCard, StatusBadge } from '@/components/ui';
import { TrendChart } from '@/components/charts';
import { ReportCard } from '@/components/ReportCard';
import { studentSemesters, semesterLabel } from '@/lib/history';
import { teacherClassIds } from '@/lib/scope';
import { avg, cn, round } from '@/lib/utils';
import type { Student } from '@/lib/types';

/** Riwayat akademik siswa: kelas dari tahun ke tahun, tren nilai, dan rapor setiap semester. */
export default function RiwayatPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { student: own, employee } = useProfile();
  const { data } = useData(['students', 'classes', 'employees', 'academic_years', 'enrollments', 'grades', 'subjects', 'student_attendance', 'units', 'schedules']);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [ayId, setAyId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const isFamily = user?.role === 'siswa' || user?.role === 'ortu';

  useEffect(() => {
    const s = Number(new URLSearchParams(window.location.search).get('s'));
    if (s) setSelectedId(s);
  }, []);

  // Siswa yang boleh dicari oleh staf (guru: hanya siswa di kelas yang diajar)
  const searchable = useMemo(() => {
    if (!data || isFamily) return [];
    let r = data.students;
    if (user?.role === 'guru') {
      const ids = teacherClassIds(employee?.id, data.schedules, data.classes);
      r = r.filter((s) => s.class_id && ids.has(s.class_id));
    } else if (unitId) r = r.filter((s) => s.unit_id === unitId);
    return r;
  }, [data, isFamily, user, employee, unitId]);

  const student: Student | undefined = isFamily ? own : searchable.find((s) => s.id === selectedId);
  const semesters = useMemo(() => (data && student ? studentSemesters(data, student) : []), [data, student]);
  useEffect(() => {
    setAyId(semesters.length ? semesters[semesters.length - 1].ay.id : null);
  }, [student?.id, semesters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Loading />;
  const openReport = (id: number) => {
    setAyId(id);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const matches = q.trim().length >= 2 ? searchable.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.nis.includes(q)).slice(0, 8) : [];
  const years = [...new Set(semesters.map((s) => s.ay.name))];
  const unit = data.units.find((u) => u.id === student?.unit_id);
  const overall = round(avg(semesters.map((s) => s.mean)), 1);
  const trend = semesters.filter((s) => s.mean !== null).map((s) => ({ label: `${s.className} ${s.ay.semester === 'Ganjil' ? 'Gj' : 'Gn'}`, nilai: s.mean }));
  const classesPassed = [...new Set(semesters.map((s) => s.className))];

  return (
    <>
      <PageHeader title="Riwayat Akademik" subtitle="Riwayat kelas dari tahun ke tahun beserta rapor setiap semester" />

      {!isFamily && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={q} onChange={setQ} placeholder="Cari siswa (nama / NIS), termasuk alumni" />
            {student && <span className="text-sm text-slate-500">Menampilkan: <b className="text-slate-800">{student.name}</b></span>}
          </div>
          {matches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {matches.map((s) => (
                <button key={s.id} onClick={() => { setSelectedId(s.id); setQ(''); }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-left text-sm hover:border-brand-400 hover:bg-brand-50">
                  <Avatar name={s.name} className="h-6 w-6 text-[9px]" />
                  <span>{s.name} <span className="text-xs text-slate-500">· {s.nis} · {s.status === 'aktif' ? data.classes.find((c) => c.id === s.class_id)?.name : s.status}</span></span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {!student ? (
        <Card><Empty text={isFamily ? 'Data siswa tidak ditemukan' : 'Cari dan pilih siswa untuk melihat riwayat akademiknya'} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-800 p-5 text-white">
            <Avatar name={student.name} className="h-14 w-14 text-lg" />
            <div className="flex-1">
              <p className="text-lg font-bold">{student.name}</p>
              <p className="text-sm text-brand-100">{unit?.name} · NIS {student.nis} · NISN {student.nisn}</p>
              <p className="text-sm text-brand-100">
                Masuk {student.entry_year} ({student.entry_type === 'pindahan' ? `pindahan dari ${student.origin_school || 'sekolah lain'}` : 'siswa baru'})
                {student.graduation_year && ` · Lulus ${student.graduation_year}`}
              </p>
            </div>
            <StatusBadge status={student.status} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Kelas yang Dilalui" value={classesPassed.length} icon={School} tone="blue" hint={classesPassed.join(' → ')} />
            <StatCard label="Semester Tercatat" value={semesters.length} icon={CalendarRange} tone="violet" />
            <StatCard label="Rata-rata Keseluruhan" value={overall ?? '-'} icon={GraduationCap} tone="green" />
            <StatCard label="Nilai Semester Terbaik" value={semesters.length ? Math.max(...semesters.map((s) => s.mean ?? 0)) : '-'} icon={Award} tone="amber" />
          </div>

          {trend.length > 1 && (
            <Card title="Tren Rata-rata Nilai per Semester" className="mb-4">
              <TrendChart data={trend} dataKey="nilai" name="Rata-rata" domain={[50, 100]} height={220} />
            </Card>
          )}

          <Card title="Riwayat Kelas" bodyClass="p-0" className="mb-4">
            {years.length ? (
              <div className="divide-y divide-slate-100">
                {years.map((year) => {
                  const rows = semesters.filter((s) => s.ay.name === year);
                  const last = rows[rows.length - 1];
                  return (
                    <div key={year} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start">
                      <div className="w-full lg:w-56">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Tahun Ajaran {year}</p>
                        <p className="text-lg font-bold text-slate-900">Kelas {rows[0].className}</p>
                        <p className="text-xs text-slate-500">Wali kelas: {rows[0].homeroomName}</p>
                        {last.enrollment?.result && (
                          <p className="mt-1 flex items-center gap-1 text-sm">
                            {last.enrollment.result === 'lulus' ? <Badge tone="blue">Lulus</Badge> : last.enrollment.result === 'naik' ? <><Badge tone="green">Naik kelas</Badge><ArrowRight className="h-3.5 w-3.5 text-slate-400" /><span className="font-medium">{last.enrollment.next_class_name}</span></> : <Badge tone="red">Tinggal kelas</Badge>}
                          </p>
                        )}
                        {rows.some((r) => r.isCurrent) && <Badge tone="violet" className="mt-1">Tahun berjalan</Badge>}
                      </div>
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        {rows.map((r) => (
                          <div key={r.ay.id} className={cn('rounded-lg border p-3', ayId === r.ay.id ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200')}>
                            <div className="flex items-center justify-between">
                              <p className="font-semibold">Semester {r.ay.semester}</p>
                              {r.isCurrent && <Badge tone="violet">Berjalan</Badge>}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="rounded bg-slate-50 p-1.5"><p className="text-base font-bold text-slate-800">{r.mean ?? '-'}</p><p className="text-slate-500">rata-rata</p></div>
                              <div className="rounded bg-slate-50 p-1.5"><p className={cn('text-base font-bold', r.below ? 'text-red-600' : 'text-slate-800')}>{r.below}</p><p className="text-slate-500">&lt; KKTP</p></div>
                              <div className="rounded bg-slate-50 p-1.5"><p className="text-base font-bold text-slate-800">{r.absences.S + r.absences.I + r.absences.A}</p><p className="text-slate-500">tidak hadir</p></div>
                            </div>
                            <Button size="sm" variant={ayId === r.ay.id ? 'primary' : 'secondary'} className="mt-2 w-full" onClick={() => openReport(r.ay.id)}><FileText className="h-4 w-4" /> Lihat Rapor</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <Empty text="Belum ada riwayat semester" />}
          </Card>

          {ayId && (
            <div ref={reportRef} className="scroll-mt-20">
              <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Rapor {semesterLabel(data.academic_years.find((y) => y.id === ayId)!)}</p>
                <div className="flex flex-wrap gap-1">
                  {semesters.map((s) => (
                    <Fragment key={s.ay.id}>
                      <button onClick={() => setAyId(s.ay.id)} className={cn('rounded-md px-2 py-1 text-xs font-medium', ayId === s.ay.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                        {s.className} · {s.ay.semester === 'Ganjil' ? 'Gj' : 'Gn'}
                      </button>
                    </Fragment>
                  ))}
                  <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>
                </div>
              </div>
              <ReportCard student={student} academicYearId={ayId} />
            </div>
          )}
        </>
      )}
    </>
  );
}
