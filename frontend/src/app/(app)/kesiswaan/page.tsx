'use client';
import { useMemo, useState } from 'react';
import { Plus, ShieldAlert, Trash2, Trophy, MessageCircle, Download } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Button, Card, DataTable, Loading, PageHeader, SearchInput, Select, StatCard, StatusBadge, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { BarsChart } from '@/components/charts';
import { indexBy, teacherClassIds } from '@/lib/scope';
import { downloadCSV, fmtDate, today } from '@/lib/utils';
import type { StudentRecord } from '@/lib/types';

const CATS = { pelanggaran: ['Kedisiplinan', 'Kerapian', 'Ketertiban', 'Akhlak', 'Kehadiran'], prestasi: ['Akademik', 'Non-Akademik', 'Kepemimpinan'], konseling: ['Pribadi', 'Sosial', 'Belajar', 'Karier'] };

export default function KesiswaanPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee, student } = useProfile();
  const { data } = useData(['student_records', 'students', 'classes', 'schedules']);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [edit, setEdit] = useState<Partial<StudentRecord> | null>(null);
  const canEdit = ['admin', 'kesiswaan', 'guru'].includes(user?.role || '');

  const rows = useMemo(() => {
    if (!data) return [];
    const studentsIdx = indexBy(data.students);
    let r = data.student_records;
    if (student) r = r.filter((x) => x.student_id === student.id);
    else if (user?.role === 'guru') {
      const ids = teacherClassIds(employee?.id, data.schedules, data.classes);
      r = r.filter((x) => ids.has(studentsIdx.get(x.student_id)?.class_id || 0));
    } else if (unitId) r = r.filter((x) => studentsIdx.get(x.student_id)?.unit_id === unitId);
    if (type) r = r.filter((x) => x.type === type);
    if (q) r = r.filter((x) => studentsIdx.get(x.student_id)?.name.toLowerCase().includes(q.toLowerCase()) || x.description.toLowerCase().includes(q.toLowerCase()));
    return [...r].sort((a, b) => b.date.localeCompare(a.date));
  }, [data, student, user, employee, unitId, type, q]);

  if (!data) return <Loading />;
  const stIdx = indexBy(data.students);
  const clsIdx = indexBy(data.classes);
  const pointsBy = new Map<number, number>();
  rows.filter((r) => r.type === 'pelanggaran').forEach((r) => pointsBy.set(r.student_id, (pointsBy.get(r.student_id) || 0) + r.points));
  const topPoints = [...pointsBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ label: stIdx.get(id)?.name.split(' ')[0] || '', poin: v }));
  const catChart = CATS.pelanggaran.map((c) => ({ label: c, jumlah: rows.filter((r) => r.type === 'pelanggaran' && r.category === c).length }));

  const cols: Column<StudentRecord>[] = [
    { key: 'date', header: 'Tanggal', render: (r) => fmtDate(r.date) },
    ...(student ? [] : [{ key: 'student', header: 'Siswa', render: (r: StudentRecord) => <div><p className="font-medium">{stIdx.get(r.student_id)?.name}</p><p className="text-xs text-slate-500">{clsIdx.get(stIdx.get(r.student_id)?.class_id || 0)?.name}</p></div> }]),
    { key: 'type', header: 'Jenis', render: (r) => <StatusBadge status={r.type} /> },
    { key: 'category', header: 'Kategori' },
    { key: 'description', header: 'Uraian' },
    { key: 'points', header: 'Poin', render: (r) => <b className={r.type === 'pelanggaran' ? 'text-red-600' : 'text-emerald-600'}>{r.type === 'pelanggaran' ? '-' : '+'}{r.points}</b> },
    { key: 'follow_up', header: 'Tindak Lanjut', render: (r) => <span className="text-xs">{r.follow_up || '-'}</span> },
    { key: 'recorded_by', header: 'Pencatat', render: (r) => <span className="text-xs">{r.recorded_by}</span> },
    ...(canEdit && user?.role !== 'guru' ? [{ key: 'a', header: '', render: (r: StudentRecord) => <Button size="sm" variant="ghost" onClick={() => confirm('Hapus catatan?') && run(() => api.remove('student_records', r.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button> }] : []),
  ];

  const studentOpts = data.students.filter((s) => s.status === 'aktif' && (!unitId || s.unit_id === unitId) && (user?.role !== 'guru' || teacherClassIds(employee?.id, data.schedules, data.classes).has(s.class_id || 0))).sort((a, b) => a.name.localeCompare(b.name));
  const vPoints = rows.filter((r) => r.type === 'pelanggaran').reduce((a, r) => a + r.points, 0);
  const aPoints = rows.filter((r) => r.type === 'prestasi').reduce((a, r) => a + r.points, 0);

  return (
    <>
      <PageHeader title={student ? 'Catatan Kesiswaan' : 'Prestasi, Pelanggaran & Konseling'} subtitle={student ? student.name : 'Pembinaan karakter dan pencatatan poin siswa'} actions={<>
        {!student && <Button variant="secondary" onClick={() => downloadCSV('catatan-kesiswaan.csv', [['Tanggal', 'NIS', 'Nama', 'Jenis', 'Kategori', 'Uraian', 'Poin', 'Tindak Lanjut'], ...rows.map((r) => [r.date, stIdx.get(r.student_id)?.nis, stIdx.get(r.student_id)?.name, r.type, r.category, r.description, r.points, r.follow_up])])}><Download className="h-4 w-4" /> CSV</Button>}
        {canEdit && !student && <Button onClick={() => setEdit({ type: 'pelanggaran', date: today(), points: 5 })}><Plus className="h-4 w-4" /> Catat</Button>}
      </>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pelanggaran" value={rows.filter((r) => r.type === 'pelanggaran').length} icon={ShieldAlert} tone="red" hint={`${vPoints} poin`} />
        <StatCard label="Prestasi" value={rows.filter((r) => r.type === 'prestasi').length} icon={Trophy} tone="green" hint={`${aPoints} poin`} />
        <StatCard label="Konseling" value={rows.filter((r) => r.type === 'konseling').length} icon={MessageCircle} tone="blue" />
        <StatCard label={student ? 'Saldo Poin' : 'Siswa Tercatat'} value={student ? aPoints - vPoints : new Set(rows.map((r) => r.student_id)).size} tone="violet" />
      </div>
      {!student && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card title="Pelanggaran per Kategori"><BarsChart data={catChart} bars={[{ key: 'jumlah', name: 'Jumlah kasus' }]} height={220} /></Card>
          <Card title="Akumulasi Poin Pelanggaran Tertinggi"><BarsChart data={topPoints} bars={[{ key: 'poin', name: 'Poin' }]} height={220} layout="vertical" /></Card>
        </div>
      )}
      <Card>
        {!student && (
          <div className="mb-4 flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Cari siswa / uraian" />
            <Select className="w-44" value={type} onChange={(e) => setType(e.target.value)} placeholder="Semua jenis" options={[{ value: 'pelanggaran', label: 'Pelanggaran' }, { value: 'prestasi', label: 'Prestasi' }, { value: 'konseling', label: 'Konseling' }]} />
          </div>
        )}
        <DataTable rows={rows} columns={cols} />
      </Card>
      <p className="mt-3 text-xs text-slate-500">Ketentuan: akumulasi 25 poin = pembinaan wali kelas, 50 poin = pemanggilan orang tua, 75 poin = surat peringatan & pertimbangan kenaikan kelas.</p>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title="Catat Kesiswaan" initial={edit || undefined}
        fields={[
          { name: 'student_id', label: 'Siswa', type: 'select', options: studentOpts.map((s) => ({ value: s.id, label: `${s.name} — ${clsIdx.get(s.class_id || 0)?.name}` })), required: true, full: true },
          { name: 'type', label: 'Jenis', type: 'select', options: [{ value: 'pelanggaran', label: 'Pelanggaran' }, { value: 'prestasi', label: 'Prestasi' }, { value: 'konseling', label: 'Konseling' }], required: true },
          { name: 'category', label: 'Kategori', type: 'select', options: [...CATS.pelanggaran, ...CATS.prestasi, ...CATS.konseling].map((c) => ({ value: c, label: c })), required: true },
          { name: 'date', label: 'Tanggal', type: 'date', required: true },
          { name: 'points', label: 'Poin', type: 'number' },
          { name: 'description', label: 'Uraian', type: 'textarea' },
          { name: 'follow_up', label: 'Tindak Lanjut', full: true },
        ]}
        onSubmit={(v) => run(async () => { await api.create('student_records', { ...v, points: v.points || 0, follow_up: v.follow_up || '', recorded_by: user?.name || '' }); setEdit(null); }, 'Catatan disimpan')} />
    </>
  );
}
