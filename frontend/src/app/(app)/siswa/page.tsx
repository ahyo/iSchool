'use client';
import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, UserMinus, Eye } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, DataTable, Field, Loading, Modal, PageHeader, SearchInput, Select, StatusBadge, Textarea, run, type Column } from '@/components/ui';
import { FormModal, type FieldDef } from '@/components/FormModal';
import { indexBy, sortClasses, teacherClassIds } from '@/lib/scope';
import { avg, downloadCSV, fmtDate, round, rupiah } from '@/lib/utils';
import type { Student } from '@/lib/types';

export default function SiswaPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee } = useProfile();
  const { data } = useData(['students', 'classes', 'guardians', 'units', 'schedules', 'student_attendance', 'bills', 'grades', 'student_records']);
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('aktif');
  const [edit, setEdit] = useState<Partial<Student> & { guardian_name?: string; guardian_phone?: string } | null>(null);
  const [detail, setDetail] = useState<Student | null>(null);
  const [mutasi, setMutasi] = useState<Student | null>(null);
  const [mut, setMut] = useState({ status: 'pindah', note: '' });

  const canEdit = user?.role === 'admin' || user?.role === 'kesiswaan';
  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.students;
    if (user?.role === 'guru') {
      const ids = teacherClassIds(employee?.id, data.schedules, data.classes);
      r = r.filter((s) => s.class_id && ids.has(s.class_id));
    } else if (unitId) r = r.filter((s) => s.unit_id === unitId);
    if (classId) r = r.filter((s) => s.class_id === Number(classId));
    if (status) r = r.filter((s) => s.status === status);
    if (q) {
      const t = q.toLowerCase();
      r = r.filter((s) => s.name.toLowerCase().includes(t) || s.nis.includes(t) || s.nisn.includes(t));
    }
    return r;
  }, [data, unitId, classId, status, q, user, employee]);

  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const guardians = indexBy(data.guardians);
  const unitClasses = data.classes.filter((c) => !unitId || c.unit_id === unitId).sort(sortClasses);

  const columns: Column<Student>[] = [
    { key: 'nis', header: 'NIS', className: 'font-mono text-xs' },
    { key: 'name', header: 'Nama', render: (s) => (<div className="flex items-center gap-2"><Avatar name={s.name} className="h-7 w-7 text-[10px]" /><span className="font-medium">{s.name}</span></div>) },
    { key: 'gender', header: 'L/P' },
    { key: 'class_id', header: 'Kelas', render: (s) => cls.get(s.class_id || 0)?.name || '-', sortValue: (s) => cls.get(s.class_id || 0)?.name || '' },
    { key: 'guardian', header: 'Orang Tua', render: (s) => guardians.get(s.guardian_id || 0)?.name || '-' },
    { key: 'entry_type', header: 'Masuk', render: (s) => <Badge tone={s.entry_type === 'pindahan' ? 'amber' : 'slate'}>{s.entry_year} · {s.entry_type}</Badge> },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'aksi', header: '', className: 'text-right', render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDetail(s)} title="Detail"><Eye className="h-4 w-4" /></Button>
          {canEdit && <Button size="sm" variant="ghost" onClick={() => { const g = guardians.get(s.guardian_id || 0); setEdit({ ...s, guardian_name: g?.name, guardian_phone: g?.phone }); }} title="Ubah"><Pencil className="h-4 w-4" /></Button>}
          {canEdit && s.status === 'aktif' && <Button size="sm" variant="ghost" onClick={() => { setMutasi(s); setMut({ status: 'pindah', note: '' }); }} title="Mutasi keluar"><UserMinus className="h-4 w-4 text-red-500" /></Button>}
        </div>
      ),
    },
  ];

  const fields: FieldDef[] = [
    { name: 'name', label: 'Nama Lengkap', required: true },
    { name: 'nis', label: 'NIS', required: true },
    { name: 'nisn', label: 'NISN' },
    { name: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }], required: true },
    { name: 'birth_place', label: 'Tempat Lahir' },
    { name: 'birth_date', label: 'Tanggal Lahir', type: 'date' },
    { name: 'religion', label: 'Agama', type: 'select', options: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((x) => ({ value: x, label: x })) },
    { name: 'class_id', label: 'Kelas', type: 'select', options: unitClasses.map((c) => ({ value: c.id, label: `${c.name} (${data.units.find((u) => u.id === c.unit_id)?.code})` })), required: true },
    { name: 'entry_year', label: 'Tahun Masuk', type: 'number' },
    { name: 'entry_type', label: 'Jalur Masuk', type: 'select', options: [{ value: 'baru', label: 'Siswa Baru' }, { value: 'pindahan', label: 'Pindahan' }] },
    { name: 'guardian_name', label: 'Nama Orang Tua/Wali' },
    { name: 'guardian_phone', label: 'No. HP Orang Tua' },
    { name: 'address', label: 'Alamat', type: 'textarea' },
  ];

  const save = async (v: Record<string, any>) => {
    const { guardian_name, guardian_phone, ...s } = v;
    const c = data.classes.find((x) => x.id === Number(s.class_id));
    s.unit_id = c?.unit_id;
    await run(async () => {
      let gid = s.guardian_id;
      if (guardian_name) {
        if (gid) await api.update('guardians', gid, { name: guardian_name, phone: guardian_phone });
        else gid = (await api.create('guardians', { name: guardian_name, phone: guardian_phone || '', relation: 'Orang Tua', email: '', occupation: '', address: s.address || '' })).id;
      }
      const payload = { ...s, guardian_id: gid ?? null };
      if (s.id) await api.update('students', s.id, payload);
      else await api.create('students', { status: 'aktif', origin_school: '', notes: '', graduation_year: null, entry_year: new Date().getFullYear(), entry_type: 'baru', nisn: '', religion: 'Islam', birth_place: '', birth_date: '', address: '', ...payload });
      setEdit(null);
    }, 'Data siswa disimpan');
  };

  // detail
  const d = detail;
  const dAtt = d ? data.student_attendance.filter((a) => a.student_id === d.id) : [];
  const dBills = d ? data.bills.filter((b) => b.student_id === d.id) : [];
  const dGrades = d ? data.grades.filter((g) => g.student_id === d.id) : [];
  const dRec = d ? data.student_records.filter((r) => r.student_id === d.id) : [];
  const g = d ? guardians.get(d.guardian_id || 0) : undefined;

  return (
    <>
      <PageHeader
        title="Data Siswa"
        subtitle={`${rows.length} siswa ditampilkan`}
        actions={<>
          <Button variant="secondary" onClick={() => downloadCSV('data-siswa.csv', [['NIS', 'NISN', 'Nama', 'L/P', 'Kelas', 'Tempat Lahir', 'Tanggal Lahir', 'Orang Tua', 'No HP', 'Status'], ...rows.map((s) => [s.nis, s.nisn, s.name, s.gender, cls.get(s.class_id || 0)?.name, s.birth_place, s.birth_date, guardians.get(s.guardian_id || 0)?.name, guardians.get(s.guardian_id || 0)?.phone, s.status])])}><Download className="h-4 w-4" /> Ekspor CSV</Button>
          {canEdit && <Button onClick={() => setEdit({ gender: 'L', entry_type: 'baru', entry_year: new Date().getFullYear() })}><Plus className="h-4 w-4" /> Tambah Siswa</Button>}
        </>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Cari nama / NIS / NISN" />
          <Select className="w-44" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={unitClasses.map((c) => ({ value: c.id, label: c.name }))} />
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Semua status" options={[{ value: 'aktif', label: 'Aktif' }, { value: 'lulus', label: 'Lulus / Alumni' }, { value: 'pindah', label: 'Pindah' }, { value: 'keluar', label: 'Keluar' }]} />
        </div>
        <DataTable rows={rows} columns={columns} />
      </Card>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Data Siswa' : 'Tambah Siswa'} fields={fields} initial={edit || undefined} onSubmit={save} />

      <Modal open={!!mutasi} onClose={() => setMutasi(null)} title="Mutasi Keluar Siswa" size="sm" footer={<>
        <Button variant="secondary" onClick={() => setMutasi(null)}>Batal</Button>
        <Button variant="danger" onClick={() => run(async () => { await api.action('students.mutate', { student_id: mutasi!.id, ...mut }); setMutasi(null); }, 'Status siswa diperbarui')}>Proses Mutasi</Button>
      </>}>
        <p className="mb-4 text-sm">Siswa: <b>{mutasi?.name}</b> ({cls.get(mutasi?.class_id || 0)?.name})</p>
        <Field label="Jenis Mutasi"><Select value={mut.status} onChange={(e) => setMut({ ...mut, status: e.target.value })} options={[{ value: 'pindah', label: 'Pindah ke sekolah lain' }, { value: 'keluar', label: 'Keluar / mengundurkan diri' }]} /></Field>
        <Field label="Keterangan (sekolah tujuan, alasan)" className="mt-3"><Textarea value={mut.note} onChange={(e) => setMut({ ...mut, note: e.target.value })} /></Field>
      </Modal>

      <Modal open={!!d} onClose={() => setDetail(null)} title="Profil Siswa" size="lg">
        {d && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-4">
              <Avatar name={d.name} className="h-14 w-14 text-lg" />
              <div>
                <p className="text-lg font-bold">{d.name}</p>
                <p className="text-slate-500">NIS {d.nis} · NISN {d.nisn || '-'} · Kelas {cls.get(d.class_id || 0)?.name || '-'}</p>
              </div>
              <div className="ml-auto"><StatusBadge status={d.status} /></div>
            </div>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {[['Tempat, Tgl Lahir', `${d.birth_place}, ${fmtDate(d.birth_date)}`], ['Agama', d.religion], ['Jalur Masuk', `${d.entry_type} (${d.entry_year})`], ['Alamat', d.address], ['Orang Tua/Wali', `${g?.name || '-'} (${g?.relation || ''})`], ['Kontak', g?.phone || '-'], ['Pekerjaan Ortu', g?.occupation || '-'], ['Catatan', d.notes || '-']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Kehadiran</p><p className="text-lg font-bold">{dAtt.length ? round((dAtt.filter((a) => a.status === 'H').length / dAtt.length) * 100, 1) : '-'}%</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Rata-rata Nilai</p><p className="text-lg font-bold">{round(avg(dGrades.map((x) => x.final)), 1) ?? '-'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Tunggakan</p><p className="text-lg font-bold text-red-600">{rupiah(dBills.reduce((a, b) => a + b.amount - b.discount - b.paid_amount, 0))}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Poin Pelanggaran</p><p className="text-lg font-bold">{dRec.filter((r) => r.type === 'pelanggaran').reduce((a, r) => a + r.points, 0)}</p></div>
            </div>
            {dRec.length > 0 && (
              <div>
                <p className="mb-2 font-semibold">Catatan Kesiswaan</p>
                {dRec.map((r) => <p key={r.id} className="flex items-center gap-2 py-1"><StatusBadge status={r.type} /> {r.description} <span className="text-slate-400">· {fmtDate(r.date)}</span></p>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
