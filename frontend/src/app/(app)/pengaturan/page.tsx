'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { api, IS_DEMO, API_URL, useData } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, Tabs, Textarea, run, toast, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy } from '@/lib/scope';
import { fmtDate } from '@/lib/utils';
import type { AcademicYear, Major, Settings, Unit, User } from '@/lib/types';

type Tab = 'profil' | 'unit' | 'tahun' | 'jurusan' | 'akun' | 'sistem';

export default function PengaturanPage() {
  const { data } = useData(['settings', 'units', 'academic_years', 'majors', 'users', 'employees', 'students', 'guardians', 'enrollments']);
  const [tab, setTab] = useState<Tab>('profil');
  const [s, setS] = useState<Settings | null>(null);
  const [editUnit, setEditUnit] = useState<Partial<Unit> | null>(null);
  const [editYear, setEditYear] = useState<Partial<AcademicYear> | null>(null);
  const [editMajor, setEditMajor] = useState<Partial<Major> | null>(null);
  const [editUser, setEditUser] = useState<Partial<User> | null>(null);
  useEffect(() => { if (data) setS(data.settings[0]); }, [data]);
  if (!data || !s) return <Loading />;
  const emp = indexBy(data.employees);
  const units = indexBy(data.units);

  const unitCols: Column<Unit>[] = [
    { key: 'code', header: 'Jenjang', render: (u) => <Badge tone="blue">{u.code}</Badge> },
    { key: 'name', header: 'Nama', render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'npsn', header: 'NPSN' },
    { key: 'accreditation', header: 'Akreditasi' },
    { key: 'grade', header: 'Tingkat', render: (u) => `${u.min_grade}–${u.max_grade}` },
    { key: 'head_id', header: 'Kepala Sekolah', render: (u) => emp.get(u.head_id || 0)?.name || '-' },
    { key: 'a', header: '', render: (u) => <Button size="sm" variant="ghost" onClick={() => setEditUnit(u)}><Pencil className="h-4 w-4" /></Button> },
  ];
  const yearCols: Column<AcademicYear>[] = [
    { key: 'name', header: 'Tahun Ajaran', render: (y) => <span className="font-medium">{y.name}</span> },
    { key: 'semester', header: 'Semester' },
    { key: 'range', header: 'Periode', render: (y) => `${fmtDate(y.start_date)} – ${fmtDate(y.end_date)}` },
    { key: 'is_active', header: 'Status', render: (y) => (y.is_active ? <Badge tone="green">Aktif</Badge> : <Button size="sm" variant="secondary" onClick={() => confirm(`Aktifkan ${y.name} ${y.semester}? Pastikan rapor semester aktif sudah diarsipkan.`) && run(() => api.action('academic_years.activate', { id: y.id }), `TA ${y.name} ${y.semester} diaktifkan`)}>Aktifkan</Button>) },
    { key: 'arsip', header: 'Arsip Rapor', render: (y) => {
      const n = data.enrollments.filter((e) => e.academic_year_id === y.id).length;
      return y.is_active
        ? <Button size="sm" variant="secondary" onClick={() => run(async () => { const r = await api.action<{ archived: number }>('academic_years.archive', { id: y.id }); toast.success(`${r.archived} rapor siswa diarsipkan`); })}>Arsipkan Rapor ({n})</Button>
        : <span className="text-xs text-slate-500">{n} siswa</span>;
    } },
    { key: 'a', header: '', render: (y) => <Button size="sm" variant="ghost" onClick={() => setEditYear(y)}><Pencil className="h-4 w-4" /></Button> },
  ];
  const majorCols: Column<Major>[] = [
    { key: 'unit_id', header: 'Unit', render: (m) => <Badge tone="blue">{units.get(m.unit_id)?.code}</Badge> },
    { key: 'code', header: 'Kode' },
    { key: 'name', header: 'Nama Jurusan / Peminatan' },
    { key: 'a', header: '', render: (m) => <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => setEditMajor(m)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => confirm('Hapus?') && run(() => api.remove('majors', m.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button></div> },
  ];
  const userCols: Column<User>[] = [
    { key: 'username', header: 'Username', className: 'font-mono text-xs' },
    { key: 'name', header: 'Nama', render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'role', header: 'Peran', render: (u) => <Badge tone="violet">{ROLE_LABEL[u.role]}</Badge> },
    { key: 'is_active', header: 'Status', render: (u) => (u.is_active ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Nonaktif</Badge>) },
    { key: 'a', header: '', render: (u) => <Button size="sm" variant="ghost" onClick={() => setEditUser({ ...u, password: '' })}><Pencil className="h-4 w-4" /></Button> },
  ];

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Profil sekolah, unit, tahun ajaran, jurusan, akun pengguna, dan sistem" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'profil', label: 'Profil Sekolah' }, { value: 'unit', label: 'Unit / Jenjang' }, { value: 'tahun', label: 'Tahun Ajaran' }, { value: 'jurusan', label: 'Jurusan' }, { value: 'akun', label: 'Akun Pengguna' }, { value: 'sistem', label: 'Sistem' }]} />

      {tab === 'profil' && (
        <Card actions={<Button size="sm" onClick={() => run(() => api.update('settings', s.id, s), 'Profil sekolah disimpan')}><Save className="h-4 w-4" /> Simpan</Button>} title="Profil Sekolah">
          <div className="grid gap-4 sm:grid-cols-2">
            {([['name', 'Nama Sekolah'], ['foundation', 'Instansi Induk (mis. Dinas Pendidikan)'], ['phone', 'Telepon'], ['email', 'Email'], ['website', 'Website']] as const).map(([k, l]) => (
              <Field key={k} label={l}><Input value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>
            ))}
            <Field label="Alamat" className="sm:col-span-2"><Textarea value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
            <Field label="Visi" className="sm:col-span-2"><Textarea value={s.vision} onChange={(e) => setS({ ...s, vision: e.target.value })} /></Field>
            <Field label="Misi (satu per baris)" className="sm:col-span-2"><Textarea rows={5} value={s.mission} onChange={(e) => setS({ ...s, mission: e.target.value })} /></Field>
            <p className="pt-2 text-sm font-semibold text-slate-700 sm:col-span-2">Rekening sekolah (ditampilkan saat siswa/orang tua membayar via transfer)</p>
            {([['bank_name', 'Nama Bank'], ['bank_account', 'No. Rekening'], ['bank_holder', 'Atas Nama']] as const).map(([k, l]) => (
              <Field key={k} label={l}><Input value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>
            ))}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={s.ppdb_open} onChange={(e) => setS({ ...s, ppdb_open: e.target.checked })} /> PPDB online dibuka</label>
          </div>
        </Card>
      )}

      {tab === 'unit' && <Card title="Unit Pendidikan" actions={<Button size="sm" onClick={() => setEditUnit({ code: 'SD', min_grade: 1, max_grade: 6, accreditation: 'A' })}><Plus className="h-4 w-4" /> Tambah Unit</Button>}><DataTable rows={data.units} columns={unitCols} /><p className="mt-3 text-xs text-slate-500">Sistem mendukung satu atau lebih unit (SD, SMP, SMA, SMK) dalam satu yayasan. Sekolah tunggal cukup memiliki satu unit.</p></Card>}
      {tab === 'tahun' && <Card title="Tahun Ajaran & Semester" actions={<Button size="sm" onClick={() => setEditYear({ semester: 'Ganjil', is_active: false })}><Plus className="h-4 w-4" /> Tambah</Button>}><DataTable rows={[...data.academic_years].sort((a, b) => b.start_date.localeCompare(a.start_date))} columns={yearCols} /><p className="mt-3 text-xs text-slate-500">Akhir semester: klik <b>Arsipkan Rapor</b> untuk menyimpan kelas, wali kelas, kehadiran, dan catatan setiap siswa ke riwayat akademik, lalu aktifkan semester berikutnya. Proses kenaikan kelas juga mengarsipkan data secara otomatis.</p></Card>}
      {tab === 'jurusan' && <Card title="Jurusan (SMK) / Peminatan (SMA)" actions={<Button size="sm" onClick={() => setEditMajor({})}><Plus className="h-4 w-4" /> Tambah</Button>}><DataTable rows={data.majors} columns={majorCols} /></Card>}
      {tab === 'akun' && <Card title="Akun Pengguna" actions={<Button size="sm" onClick={() => setEditUser({ role: 'guru', is_active: true })}><Plus className="h-4 w-4" /> Tambah Akun</Button>}><DataTable rows={data.users} columns={userCols} /></Card>}
      {tab === 'sistem' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Database className="h-4 w-4" /> Sumber Data</span>}>
            {IS_DEMO ? (
              <div className="space-y-2 text-sm">
                <p><Badge tone="amber">MODE DEMO</Badge></p>
                <p className="text-slate-600">Data disimpan di <b>localStorage</b> browser ini. Perubahan tidak dibagikan ke pengguna lain. Untuk produksi, jalankan backend FastAPI + PostgreSQL lalu build frontend dengan <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_API_URL</code>.</p>
                <p className="text-slate-600">Jumlah data: {data.students.length} siswa, {data.employees.length} pegawai, {data.guardians.length} orang tua, {data.users.length} akun.</p>
              </div>
            ) : (
              <p className="text-sm"><Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" />LIVE</Badge> Terhubung ke API <code>{API_URL}</code></p>
            )}
          </Card>
          {IS_DEMO && (
            <Card title="Reset Data Demo">
              <p className="mb-3 text-sm text-slate-600">Kembalikan seluruh data ke kondisi awal (data contoh). Semua perubahan yang Anda buat akan hilang.</p>
              <Button variant="danger" onClick={() => confirm('Reset seluruh data demo?') && run(() => api.action('demo.reset'), 'Data demo telah direset')}><RotateCcw className="h-4 w-4" /> Reset Data Demo</Button>
            </Card>
          )}
        </div>
      )}

      <FormModal open={!!editUnit} onClose={() => setEditUnit(null)} title="Unit Pendidikan" initial={editUnit || undefined}
        fields={[
          { name: 'code', label: 'Jenjang', type: 'select', options: ['SD', 'SMP', 'SMA', 'SMK'].map((x) => ({ value: x, label: x })), required: true },
          { name: 'name', label: 'Nama Sekolah', required: true },
          { name: 'npsn', label: 'NPSN' },
          { name: 'accreditation', label: 'Akreditasi' },
          { name: 'min_grade', label: 'Tingkat Awal', type: 'number' },
          { name: 'max_grade', label: 'Tingkat Akhir', type: 'number' },
          { name: 'head_id', label: 'Kepala Sekolah', type: 'select', options: data.employees.map((e) => ({ value: e.id, label: e.name })) },
          { name: 'address', label: 'Alamat', type: 'textarea' },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('units', v.id, v); else await api.create('units', { address: '', npsn: '', ...v }); setEditUnit(null); }, 'Unit disimpan')} />
      <FormModal open={!!editYear} onClose={() => setEditYear(null)} title="Tahun Ajaran" initial={editYear || undefined} size="md"
        fields={[
          { name: 'name', label: 'Tahun Ajaran', placeholder: '2027/2028', required: true },
          { name: 'semester', label: 'Semester', type: 'select', options: [{ value: 'Ganjil', label: 'Ganjil' }, { value: 'Genap', label: 'Genap' }] },
          { name: 'start_date', label: 'Mulai', type: 'date' },
          { name: 'end_date', label: 'Selesai', type: 'date' },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('academic_years', v.id, v); else await api.create('academic_years', { ...v, is_active: false }); setEditYear(null); }, 'Tahun ajaran disimpan')} />
      <FormModal open={!!editMajor} onClose={() => setEditMajor(null)} title="Jurusan" initial={editMajor || undefined} size="md"
        fields={[
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.filter((u) => u.code === 'SMA' || u.code === 'SMK').map((u) => ({ value: u.id, label: u.name })), required: true },
          { name: 'code', label: 'Kode', required: true },
          { name: 'name', label: 'Nama', required: true, full: true },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('majors', v.id, v); else await api.create('majors', v); setEditMajor(null); }, 'Jurusan disimpan')} />
      <FormModal open={!!editUser} onClose={() => setEditUser(null)} title="Akun Pengguna" initial={editUser || undefined}
        fields={[
          { name: 'username', label: 'Username', required: true },
          { name: 'password', label: editUser?.id ? 'Password baru (kosongkan jika tetap)' : 'Password', type: 'password', required: !editUser?.id },
          { name: 'name', label: 'Nama Tampilan', required: true },
          { name: 'role', label: 'Peran', type: 'select', options: Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: l })), required: true },
          { name: 'employee_id', label: 'Tautkan ke Pegawai', type: 'select', options: data.employees.map((e) => ({ value: e.id, label: e.name })), show: (v) => ['guru', 'kepsek', 'keuangan', 'kesiswaan'].includes(v.role) },
          { name: 'student_id', label: 'Tautkan ke Siswa', type: 'select', options: data.students.filter((x) => x.status === 'aktif').map((x) => ({ value: x.id, label: `${x.name} (${x.nis})` })), show: (v) => v.role === 'siswa' },
          { name: 'guardian_id', label: 'Tautkan ke Orang Tua', type: 'select', options: data.guardians.map((g) => ({ value: g.id, label: `${g.name} (${g.phone})` })), show: (v) => v.role === 'ortu' },
          { name: 'is_active', label: 'Aktif', type: 'checkbox' },
        ]}
        onSubmit={(v) => run(async () => {
          const payload: Record<string, any> = { ...v, employee_id: v.employee_id || null, student_id: v.student_id || null, guardian_id: v.guardian_id || null };
          if (!payload.password) delete payload.password;
          if (v.id) await api.update('users', v.id, payload);
          else await api.create('users', payload);
          setEditUser(null);
        }, 'Akun disimpan')} />
    </>
  );
}
