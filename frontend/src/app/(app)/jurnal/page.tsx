'use client';
import { useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, Download, Pencil, Plus } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, DataTable, Empty, Input, Loading, PageHeader, ProgressBar, Select, StatCard, Tabs, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy, teacherPairs } from '@/lib/scope';
import { addDays, cn, downloadCSV, fmtDate, isWeekend, nowISO, today } from '@/lib/utils';
import type { Schedule, TeachingJournal } from '@/lib/types';

const dow = (d: string) => new Date(d + 'T00:00:00').getDay();

function lastSchoolDays(n: number) {
  const out: string[] = [];
  for (let d = today(); out.length < n; d = addDays(d, -1)) if (!isWeekend(d)) out.unshift(d);
  return out;
}

export default function JurnalPage() {
  const { user } = useAuth();
  return user?.role === 'guru' ? <TeacherJournal /> : <JournalMonitor />;
}

function TeacherJournal() {
  const { employee } = useProfile();
  const { data } = useData(['teaching_journals', 'schedules', 'classes', 'subjects', 'student_attendance', 'lessons']);
  const [edit, setEdit] = useState<Partial<TeachingJournal> | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  if (!data || !employee) return <Loading />;
  const cls = indexBy(data.classes);
  const sub = indexBy(data.subjects);
  const mine = data.teaching_journals.filter((j) => j.teacher_id === employee.id);
  const journalFor = (s: Schedule, date: string) => mine.find((j) => j.date === date && j.class_id === s.class_id && j.subject_id === s.subject_id && j.start_time === s.start_time);
  const sessionsOn = (date: string) => (isWeekend(date) ? [] : data.schedules.filter((s) => s.teacher_id === employee.id && s.day === dow(date)).sort((a, b) => a.start_time.localeCompare(b.start_time)));
  const todays = sessionsOn(today());
  const recentDays = lastSchoolDays(5);
  const missing = recentDays.flatMap((d) => sessionsOn(d).filter((s) => !journalFor(s, d)).map((s) => ({ s, d })));
  const totalSessions = recentDays.reduce((a, d) => a + sessionsOn(d).length, 0);

  const prefill = (s: Schedule, date: string): Partial<TeachingJournal> => {
    const att = data.student_attendance.filter((a) => a.class_id === s.class_id && a.date === date);
    const lastLesson = data.lessons.filter((l) => l.class_id === s.class_id && l.subject_id === s.subject_id && l.is_published).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { class_id: s.class_id, subject_id: s.subject_id, date, start_time: s.start_time, topic: lastLesson ? lastLesson.title : '', activities: 'Apersepsi, penjelasan materi, latihan terbimbing, refleksi.', notes: '', present: att.filter((a) => a.status === 'H').length, absent: att.filter((a) => a.status !== 'H').length };
  };

  const session = (s: Schedule, date: string) => {
    const j = journalFor(s, date);
    return (
      <div key={`${date}-${s.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="w-24 font-mono text-xs text-slate-500">{s.start_time}–{s.end_time}</span>
        <div className="min-w-[180px] flex-1">
          <p className="font-medium">{sub.get(s.subject_id)?.name} · {cls.get(s.class_id)?.name}</p>
          {j ? <p className="text-sm text-slate-600">{j.topic}</p> : <p className="text-sm text-amber-600">Jurnal belum diisi</p>}
        </div>
        {j ? (
          <><Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" />Terisi</Badge><Button size="sm" variant="ghost" onClick={() => setEdit(j)}><Pencil className="h-4 w-4" /></Button></>
        ) : <Button size="sm" onClick={() => setEdit(prefill(s, date))}><Plus className="h-4 w-4" /> Isi Jurnal</Button>}
      </div>
    );
  };

  const history = mine.filter((j) => j.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
  const pairs = teacherPairs(employee.id, data.schedules);
  const cols: Column<TeachingJournal>[] = [
    { key: 'date', header: 'Tanggal', render: (j) => <span className="whitespace-nowrap">{fmtDate(j.date, { weekday: 'short', day: 'numeric', month: 'short' })} {j.start_time}</span> },
    { key: 'kelas', header: 'Kelas / Mapel', render: (j) => <span>{cls.get(j.class_id)?.name} · {sub.get(j.subject_id)?.code}</span> },
    { key: 'topic', header: 'Materi / Topik', render: (j) => <span className="font-medium">{j.topic}</span> },
    { key: 'hadir', header: 'Hadir', render: (j) => `${j.present}/${j.present + j.absent}` },
    { key: 'notes', header: 'Catatan', render: (j) => <span className="text-xs text-slate-500">{j.notes || '-'}</span> },
    { key: 'a', header: '', render: (j) => <Button size="sm" variant="ghost" onClick={() => setEdit(j)}><Pencil className="h-4 w-4" /></Button> },
  ];

  return (
    <>
      <PageHeader title="Jurnal Mengajar" subtitle="Catat materi, kegiatan, dan kehadiran setiap sesi mengajar" actions={<Button variant="secondary" onClick={() => setEdit({ date: today(), class_id: pairs[0]?.class_id, subject_id: pairs[0]?.subject_id, start_time: '07:30', present: 0, absent: 0 })}><Plus className="h-4 w-4" /> Jurnal Manual</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Sesi Hari Ini" value={todays.length} icon={BookMarked} tone="blue" hint={`${todays.filter((s) => journalFor(s, today())).length} sudah diisi`} />
        <StatCard label="Keterisian 5 Hari Terakhir" value={`${totalSessions ? Math.round(((totalSessions - missing.length) / totalSessions) * 100) : 100}%`} tone="green" />
        <StatCard label="Belum Diisi" value={missing.length} tone={missing.length ? 'amber' : 'slate'} hint="5 hari sekolah terakhir" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Sesi Hari Ini · ${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}`} bodyClass="p-0">
          <div className="divide-y divide-slate-100">{todays.map((s) => session(s, today()))}</div>
          {!todays.length && <Empty text="Tidak ada jadwal mengajar hari ini" />}
        </Card>
        <Card title="Belum Diisi (5 hari terakhir)" bodyClass="p-0 max-h-80 overflow-y-auto">
          <div className="divide-y divide-slate-100">
            {missing.filter((m) => m.d !== today()).map(({ s, d }) => (
              <div key={`${d}-${s.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 text-xs text-slate-500">{fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })} {s.start_time}</span>
                <span className="flex-1">{sub.get(s.subject_id)?.code} · {cls.get(s.class_id)?.name}</span>
                <Button size="sm" variant="secondary" onClick={() => setEdit(prefill(s, d))}>Isi</Button>
              </div>
            ))}
          </div>
          {!missing.filter((m) => m.d !== today()).length && <Empty text="Semua jurnal sudah diisi 👍" />}
        </Card>
      </div>
      <Card title="Riwayat Jurnal" actions={<><Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} /><Button size="sm" variant="secondary" onClick={() => downloadCSV(`jurnal-mengajar-${month}.csv`, [['Tanggal', 'Jam', 'Kelas', 'Mapel', 'Materi', 'Kegiatan', 'Hadir', 'Tidak Hadir', 'Catatan'], ...history.map((j) => [j.date, j.start_time, cls.get(j.class_id)?.name, sub.get(j.subject_id)?.name, j.topic, j.activities, j.present, j.absent, j.notes])])}><Download className="h-4 w-4" /> CSV</Button></>}>
        <DataTable rows={history} columns={cols} pageSize={15} empty="Belum ada jurnal pada bulan ini" />
      </Card>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Jurnal' : 'Isi Jurnal Mengajar'} initial={edit || undefined}
        fields={[
          { name: 'date', label: 'Tanggal', type: 'date', required: true },
          { name: 'start_time', label: 'Jam Mulai', type: 'time', required: true },
          { name: 'class_id', label: 'Kelas', type: 'select', options: [...new Set(pairs.map((p) => p.class_id))].map((id) => ({ value: id, label: cls.get(id)?.name || '' })), required: true },
          { name: 'subject_id', label: 'Mata Pelajaran', type: 'select', options: [...new Set(pairs.map((p) => p.subject_id))].map((id) => ({ value: id, label: sub.get(id)?.name || '' })), required: true },
          { name: 'topic', label: 'Materi / Topik', required: true, full: true },
          { name: 'activities', label: 'Kegiatan Pembelajaran', type: 'textarea' },
          { name: 'present', label: 'Siswa Hadir', type: 'number' },
          { name: 'absent', label: 'Siswa Tidak Hadir', type: 'number' },
          { name: 'notes', label: 'Catatan / Kendala', full: true },
        ]}
        onSubmit={(v) => run(async () => {
          if (!v.topic) throw new Error('Materi/topik wajib diisi');
          const payload = { ...v, present: v.present || 0, absent: v.absent || 0, activities: v.activities || '', notes: v.notes || '' };
          if (v.id) await api.update('teaching_journals', v.id, payload);
          else await api.create('teaching_journals', { ...payload, teacher_id: employee.id, created_at: nowISO() });
          setEdit(null);
        }, 'Jurnal disimpan')} />
    </>
  );
}

function JournalMonitor() {
  const { unitId } = useWorkspace();
  const { data } = useData(['teaching_journals', 'schedules', 'classes', 'subjects', 'employees']);
  const [tab, setTab] = useState<'rekap' | 'jurnal'>('rekap');
  const [teacher, setTeacher] = useState('');
  const days = useMemo(() => lastSchoolDays(5).filter((d) => d !== today() || new Date().getHours() >= 15), []);
  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const sub = indexBy(data.subjects);
  const emp = indexBy(data.employees);
  const teachers = data.employees.filter((e) => e.type === 'guru' && e.is_active && (!unitId || e.unit_id === unitId));
  type R = { id: number; name: string; unit: number | null; scheduled: number; filled: number; pct: number };
  const rekap: R[] = teachers.map((t) => {
    const scheduled = days.reduce((a, d) => a + data.schedules.filter((s) => s.teacher_id === t.id && s.day === dow(d)).length, 0);
    const filled = data.teaching_journals.filter((j) => j.teacher_id === t.id && days.includes(j.date)).length;
    return { id: t.id, name: t.name, unit: t.unit_id, scheduled, filled: Math.min(filled, scheduled), pct: scheduled ? Math.round((Math.min(filled, scheduled) / scheduled) * 100) : 100 };
  }).filter((r) => r.scheduled > 0);
  const totalS = rekap.reduce((a, r) => a + r.scheduled, 0), totalF = rekap.reduce((a, r) => a + r.filled, 0);
  const cols: Column<R>[] = [
    { key: 'name', header: 'Guru', render: (r) => <span className="flex items-center gap-2"><Avatar name={r.name} className="h-7 w-7 text-[10px]" />{r.name}</span> },
    { key: 'scheduled', header: 'Sesi Terjadwal' },
    { key: 'filled', header: 'Jurnal Terisi' },
    { key: 'pct', header: 'Keterisian', sortValue: (r) => r.pct, render: (r) => <div className="flex w-48 items-center gap-2"><ProgressBar value={r.pct} tone={r.pct >= 90 ? 'green' : r.pct >= 60 ? 'amber' : 'red'} /><span className="w-10 text-right text-xs">{r.pct}%</span></div> },
    { key: 'a', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => { setTeacher(String(r.id)); setTab('jurnal'); }}>Lihat</Button> },
  ];
  const journals = data.teaching_journals.filter((j) => (!teacher || j.teacher_id === Number(teacher)) && (!unitId || cls.get(j.class_id)?.unit_id === unitId)).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
  const jcols: Column<TeachingJournal>[] = [
    { key: 'date', header: 'Tanggal', render: (j) => <span className="whitespace-nowrap">{fmtDate(j.date, { weekday: 'short', day: 'numeric', month: 'short' })} {j.start_time}</span> },
    { key: 'guru', header: 'Guru', render: (j) => <span className="text-xs">{emp.get(j.teacher_id)?.name}</span> },
    { key: 'kelas', header: 'Kelas / Mapel', render: (j) => `${cls.get(j.class_id)?.name} · ${sub.get(j.subject_id)?.code}` },
    { key: 'topic', header: 'Materi', render: (j) => <span className="font-medium">{j.topic}</span> },
    { key: 'hadir', header: 'Hadir', render: (j) => `${j.present}/${j.present + j.absent}` },
    { key: 'notes', header: 'Catatan', render: (j) => <span className={cn('text-xs', j.notes ? 'text-amber-700' : 'text-slate-400')}>{j.notes || '-'}</span> },
  ];
  return (
    <>
      <PageHeader title="Jurnal Mengajar" subtitle={`Pemantauan keterisian jurnal guru · ${fmtDate(days[0])} – ${fmtDate(days[days.length - 1])}`} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sesi Terjadwal" value={totalS} tone="blue" />
        <StatCard label="Jurnal Terisi" value={totalF} tone="green" />
        <StatCard label="Keterisian" value={`${totalS ? Math.round((totalF / totalS) * 100) : 0}%`} tone="violet" />
        <StatCard label="Guru < 60%" value={rekap.filter((r) => r.pct < 60).length} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'rekap', label: 'Rekap per Guru' }, { value: 'jurnal', label: 'Isi Jurnal' }]} />
      {tab === 'rekap' ? (
        <Card><DataTable rows={rekap} columns={cols} pageSize={20} /></Card>
      ) : (
        <Card actions={<Select className="w-72" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Semua guru" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />} title="Jurnal Mengajar">
          <DataTable rows={journals} columns={jcols} pageSize={20} empty="Belum ada jurnal" />
        </Card>
      )}
    </>
  );
}
