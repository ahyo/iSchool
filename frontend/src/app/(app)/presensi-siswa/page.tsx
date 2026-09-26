'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, Save } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Button, Card, DataTable, Input, Loading, PageHeader, Select, StatCard, StatusBadge, Tabs, run, type Column } from '@/components/ui';
import { indexBy, sortClasses, teacherClassIds } from '@/lib/scope';
import { cn, downloadCSV, fmtDate, isWeekend, round, today } from '@/lib/utils';
import type { AttendanceStatus, Student } from '@/lib/types';

const STATUSES: { v: AttendanceStatus; label: string; cls: string }[] = [
  { v: 'H', label: 'Hadir', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'S', label: 'Sakit', cls: 'bg-amber-500 text-white border-amber-500' },
  { v: 'I', label: 'Izin', cls: 'bg-blue-600 text-white border-blue-600' },
  { v: 'A', label: 'Alpa', cls: 'bg-red-600 text-white border-red-600' },
];

function MyAttendance() {
  const { student } = useProfile();
  const { data } = useData(['student_attendance']);
  const [month, setMonth] = useState(today().slice(0, 7));
  if (!data || !student) return <Loading />;
  const all = data.student_attendance.filter((a) => a.student_id === student.id);
  const rows = all.filter((a) => a.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const count = (s: string, list = all) => list.filter((a) => a.status === s).length;
  return (
    <>
      <PageHeader title="Rekap Kehadiran" subtitle={student.name} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Persentase Hadir" value={`${all.length ? round((count('H') / all.length) * 100, 1) : '-'}%`} tone="green" />
        <StatCard label="Hadir" value={count('H')} tone="green" />
        <StatCard label="Sakit" value={count('S')} tone="amber" />
        <StatCard label="Izin" value={count('I')} tone="blue" />
        <StatCard label="Alpa" value={count('A')} tone="red" />
      </div>
      <Card title="Riwayat Harian" actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {rows.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500">{fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              <div className="mt-1"><StatusBadge status={a.status} /></div>
              {a.note && <p className="mt-1 text-xs text-slate-500">{a.note}</p>}
            </div>
          ))}
        </div>
        {!rows.length && <p className="py-6 text-center text-sm text-slate-400">Belum ada data kehadiran bulan ini</p>}
      </Card>
    </>
  );
}

export default function PresensiSiswaPage() {
  const { user } = useAuth();
  if (user?.role === 'siswa' || user?.role === 'ortu') return <MyAttendance />;
  return <StaffAttendance />;
}

function StaffAttendance() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee } = useProfile();
  const { data } = useData(['classes', 'students', 'student_attendance', 'schedules']);
  const [tab, setTab] = useState<'input' | 'rekap'>('input');
  const [classId, setClassId] = useState(0);
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [marks, setMarks] = useState<Record<number, { status: AttendanceStatus; note: string }>>({});
  const [busy, setBusy] = useState(false);

  const classes = useMemo(() => {
    if (!data) return [];
    let c = data.classes;
    if (user?.role === 'guru') {
      const ids = teacherClassIds(employee?.id, data.schedules, data.classes);
      c = c.filter((x) => ids.has(x.id));
    } else if (unitId) c = c.filter((x) => x.unit_id === unitId);
    return [...c].sort(sortClasses);
  }, [data, user, employee, unitId]);

  useEffect(() => {
    if (!classes.length) return;
    if (!classes.some((c) => c.id === classId)) {
      const hr = classes.find((c) => c.homeroom_id === employee?.id);
      setClassId((hr || classes[0]).id);
    }
  }, [classes, classId, employee]);

  const students = useMemo(() => (data?.students || []).filter((s) => s.class_id === classId && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name)), [data, classId]);
  const existing = useMemo(() => (data?.student_attendance || []).filter((a) => a.class_id === classId && a.date === date), [data, classId, date]);

  useEffect(() => {
    const m: Record<number, { status: AttendanceStatus; note: string }> = {};
    students.forEach((s) => {
      const ex = existing.find((a) => a.student_id === s.id);
      m[s.id] = { status: ex?.status || 'H', note: ex?.note || '' };
    });
    setMarks(m);
  }, [students, existing]);

  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const filled = existing.length > 0;

  const save = async () => {
    setBusy(true);
    await run(() => api.action('attendance.saveClass', { class_id: classId, date, entries: students.map((s) => ({ student_id: s.id, ...marks[s.id] })) }), `Presensi ${cls.get(classId)?.name} tanggal ${fmtDate(date)} disimpan`);
    setBusy(false);
  };

  // Rekap
  const monthAtt = data.student_attendance.filter((a) => a.class_id === classId && a.date.startsWith(month));
  type RekapRow = Student & { H: number; S: number; I: number; A: number; pct: number | null };
  const rekap: RekapRow[] = students.map((s) => {
    const r = monthAtt.filter((a) => a.student_id === s.id);
    const c = (x: string) => r.filter((a) => a.status === x).length;
    return { ...s, H: c('H'), S: c('S'), I: c('I'), A: c('A'), pct: r.length ? round((c('H') / r.length) * 100, 1) : null };
  });
  const days = new Set(monthAtt.map((a) => a.date)).size;
  const rekapCols: Column<RekapRow>[] = [
    { key: 'nis', header: 'NIS', className: 'font-mono text-xs' },
    { key: 'name', header: 'Nama', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'H', header: 'Hadir', className: 'text-center' },
    { key: 'S', header: 'Sakit', className: 'text-center' },
    { key: 'I', header: 'Izin', className: 'text-center' },
    { key: 'A', header: 'Alpa', className: 'text-center', render: (s) => <span className={s.A > 2 ? 'font-bold text-red-600' : ''}>{s.A}</span> },
    { key: 'pct', header: '% Hadir', sortValue: (s) => s.pct ?? 0, render: (s) => <span className={cn('font-semibold', (s.pct ?? 100) < 90 ? 'text-red-600' : 'text-emerald-600')}>{s.pct ?? '-'}%</span> },
  ];

  return (
    <>
      <PageHeader title="Presensi Siswa" subtitle="Input kehadiran harian per kelas dan rekap bulanan" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'input', label: 'Input Harian' }, { value: 'rekap', label: 'Rekap Bulanan' }]} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select className="w-52" value={classId} onChange={(e) => setClassId(Number(e.target.value))} options={classes.map((c) => ({ value: c.id, label: `${c.name}${c.homeroom_id === employee?.id ? ' (perwalian)' : ''}` }))} />
        {tab === 'input' ? <Input type="date" className="w-44" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /> : <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />}
        {tab === 'input' && <span className={cn('text-sm', filled ? 'text-emerald-600' : 'text-amber-600')}>{filled ? '✓ Sudah diisi (dapat diperbarui)' : 'Belum diisi'}</span>}
      </div>

      {tab === 'input' ? (
        <Card
          title={`${cls.get(classId)?.name || ''} · ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
          actions={<>
            <Button variant="secondary" size="sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, { status: 'H' as AttendanceStatus, note: '' }])))}><CheckCheck className="h-4 w-4" /> Semua Hadir</Button>
            <Button size="sm" onClick={save} loading={busy} disabled={isWeekend(date)}><Save className="h-4 w-4" /> Simpan</Button>
          </>}
        >
          {isWeekend(date) && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Tanggal yang dipilih adalah akhir pekan. Pilih hari sekolah untuk mengisi presensi.</p>}
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            {STATUSES.map((s) => <span key={s.v} className="text-slate-600">{s.label}: <b>{Object.values(marks).filter((m) => m.status === s.v).length}</b></span>)}
          </div>
          <div className="divide-y divide-slate-100">
            {students.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-6 text-sm text-slate-400">{i + 1}</span>
                <Avatar name={s.name} className="h-8 w-8" />
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-slate-500">{s.nis}</p>
                </div>
                <div className="flex gap-1">
                  {STATUSES.map((st) => (
                    <button key={st.v} onClick={() => setMarks((m) => ({ ...m, [s.id]: { ...m[s.id], status: st.v } }))} className={cn('h-8 w-10 rounded-md border text-xs font-bold transition', marks[s.id]?.status === st.v ? st.cls : 'border-slate-200 text-slate-500 hover:bg-slate-50')} title={st.label}>
                      {st.v}
                    </button>
                  ))}
                </div>
                <Input className="w-full sm:w-56" placeholder="Keterangan" value={marks[s.id]?.note || ''} onChange={(e) => setMarks((m) => ({ ...m, [s.id]: { ...m[s.id], note: e.target.value } }))} />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card title={`Rekap ${cls.get(classId)?.name || ''} · ${days} hari efektif`} actions={<Button variant="secondary" size="sm" onClick={() => downloadCSV(`rekap-presensi-${cls.get(classId)?.name}-${month}.csv`, [['NIS', 'Nama', 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Hadir'], ...rekap.map((r) => [r.nis, r.name, r.H, r.S, r.I, r.A, r.pct])])}><Download className="h-4 w-4" /> CSV</Button>}>
          <DataTable rows={rekap} columns={rekapCols} pageSize={40} />
        </Card>
      )}
    </>
  );
}
