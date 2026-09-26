'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, UserPlus, ArrowLeftRight, CheckCircle2, XCircle, ClipboardCheck, GraduationCap } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, StatCard, StatusBadge, Tabs, Textarea, run, toast, type Column } from '@/components/ui';
import { indexBy, sortClasses } from '@/lib/scope';
import { downloadCSV, fmtDate, fmtDateTime, gradeLabel } from '@/lib/utils';
import type { Applicant, Student } from '@/lib/types';

export default function PenerimaanPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['applicants', 'units', 'majors', 'classes', 'bills', 'students', 'settings']);
  const [tab, setTab] = useState<'pendaftar' | 'mutasi'>('pendaftar');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sel, setSel] = useState<Applicant | null>(null);
  const [form, setForm] = useState({ test_score: '', notes: '', class_id: '' });
  const [enrolled, setEnrolled] = useState<{ username: string; parent_username: string; password: string } | null>(null);
  const canManage = user?.role === 'admin' || user?.role === 'kesiswaan';

  const rows = useMemo(() => {
    if (!data) return [];
    return data.applicants
      .filter((a) => (!unitId || a.unit_id === unitId) && (!status || a.status === status) && (!type || a.type === type))
      .filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.reg_no.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data, unitId, status, type, q]);

  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const majors = indexBy(data.majors);
  const settings = data.settings[0];
  const regBill = (a: Applicant) => data.bills.find((b) => b.applicant_id === a.id);
  const all = data.applicants.filter((a) => !unitId || a.unit_id === unitId);

  const open = (a: Applicant) => {
    setSel(a);
    setForm({ test_score: a.test_score?.toString() || '', notes: a.notes, class_id: '' });
  };
  const setStatusTo = (s: Applicant['status']) =>
    run(async () => {
      const upd = await api.update('applicants', sel!.id, { status: s, test_score: form.test_score ? Number(form.test_score) : null, notes: form.notes });
      setSel(upd);
    }, 'Status pendaftar diperbarui');

  const columns: Column<Applicant>[] = [
    { key: 'reg_no', header: 'No. Daftar', className: 'font-mono text-xs' },
    { key: 'name', header: 'Nama', render: (a) => <span className="font-medium">{a.name}</span> },
    { key: 'type', header: 'Jalur', render: (a) => <Badge tone={a.type === 'pindahan' ? 'amber' : 'blue'}>{a.type === 'pindahan' ? 'Pindahan' : 'Baru'}</Badge> },
    { key: 'unit_id', header: 'Tujuan', render: (a) => `${units.get(a.unit_id)?.code} · Kls ${gradeLabel(a.grade_target)}${a.major_id ? ' ' + majors.get(a.major_id)?.code : ''}` },
    { key: 'origin_school', header: 'Asal Sekolah' },
    { key: 'bayar', header: 'Biaya Daftar', render: (a) => <StatusBadge status={regBill(a)?.status || 'belum'} /> },
    { key: 'created_at', header: 'Tanggal', render: (a) => fmtDate(a.created_at) },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  ];

  const mutasi = data.students.filter((s) => (s.status === 'pindah' || s.status === 'keluar' || s.entry_type === 'pindahan') && (!unitId || s.unit_id === unitId));
  const mutasiCols: Column<Student>[] = [
    { key: 'nis', header: 'NIS', className: 'font-mono text-xs' },
    { key: 'name', header: 'Nama', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'unit', header: 'Unit', render: (s) => units.get(s.unit_id)?.code },
    { key: 'arah', header: 'Mutasi', render: (s) => s.status === 'aktif' ? <Badge tone="green">Masuk</Badge> : <Badge tone="red">Keluar</Badge> },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    { key: 'notes', header: 'Keterangan', render: (s) => <span className="whitespace-pre-line text-xs text-slate-500">{s.notes || s.origin_school || '-'}</span> },
  ];

  const selClasses = sel ? data.classes.filter((c) => c.unit_id === sel.unit_id && c.grade === sel.grade_target && (!sel.major_id || !c.major_id || c.major_id === sel.major_id)).sort(sortClasses) : [];

  return (
    <>
      <PageHeader
        title="PPDB & Mutasi Siswa"
        subtitle="Penerimaan peserta didik baru, siswa pindahan (mutasi masuk), dan mutasi keluar"
        actions={<>
          <Link href="/ppdb/" target="_blank"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Formulir Publik</Button></Link>
          {user?.role === 'admin' && (
            <Button variant={settings.ppdb_open ? 'danger' : 'success'} onClick={() => run(() => api.update('settings', settings.id, { ppdb_open: !settings.ppdb_open }), settings.ppdb_open ? 'PPDB ditutup' : 'PPDB dibuka')}>
              {settings.ppdb_open ? 'Tutup PPDB' : 'Buka PPDB'}
            </Button>
          )}
        </>}
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Pendaftar" value={all.length} icon={UserPlus} tone="blue" hint={`${all.filter((a) => a.type === 'pindahan').length} pindahan`} />
        <StatCard label="Perlu Verifikasi" value={all.filter((a) => a.status === 'baru' || a.status === 'verifikasi').length} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Diterima" value={all.filter((a) => a.status === 'diterima' || a.status === 'daftar_ulang').length} icon={CheckCircle2} tone="green" />
        <StatCard label="Sudah Daftar Ulang" value={all.filter((a) => a.status === 'daftar_ulang').length} icon={GraduationCap} tone="violet" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pendaftar', label: 'Pendaftar PPDB' }, { value: 'mutasi', label: 'Riwayat Mutasi' }]} />
      {tab === 'pendaftar' ? (
        <Card>
          <div className="mb-4 flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Cari nama / no. daftar" />
            <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Semua status" options={['baru', 'verifikasi', 'diterima', 'daftar_ulang', 'ditolak'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} />
            <Select className="w-36" value={type} onChange={(e) => setType(e.target.value)} placeholder="Semua jalur" options={[{ value: 'baru', label: 'Siswa Baru' }, { value: 'pindahan', label: 'Pindahan' }]} />
            <Button variant="secondary" className="ml-auto" onClick={() => downloadCSV('pendaftar-ppdb.csv', [['No Daftar', 'Nama', 'Jalur', 'Unit', 'Kelas', 'Asal Sekolah', 'Tgl Lahir', 'Orang Tua', 'HP', 'Status', 'Nilai Tes'], ...rows.map((a) => [a.reg_no, a.name, a.type, units.get(a.unit_id)?.code, a.grade_target, a.origin_school, a.birth_date, a.parent_name, a.parent_phone, a.status, a.test_score])])}><Download className="h-4 w-4" /> CSV</Button>
          </div>
          <DataTable rows={rows} columns={columns} onRowClick={open} />
        </Card>
      ) : (
        <Card title={<span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Siswa Pindahan & Mutasi Keluar</span>}>
          <DataTable rows={mutasi} columns={mutasiCols} />
          <p className="mt-3 text-xs text-slate-500">Mutasi keluar diproses dari menu Data Siswa (ikon mutasi). Mutasi masuk diproses melalui PPDB jalur pindahan.</p>
        </Card>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={`Pendaftar ${sel?.reg_no || ''}`} size="lg">
        {sel && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold">{sel.name}</p>
              <StatusBadge status={sel.status} />
              <Badge tone={sel.type === 'pindahan' ? 'amber' : 'blue'}>{sel.type === 'pindahan' ? 'Pindahan' : 'Siswa Baru'}</Badge>
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {[['Tujuan', `${units.get(sel.unit_id)?.name} · Kelas ${gradeLabel(sel.grade_target)}`], ['Jurusan', sel.major_id ? majors.get(sel.major_id)?.name : '-'], ['NISN', sel.nisn || '-'], ['TTL', `${sel.birth_place}, ${fmtDate(sel.birth_date)}`], ['Jenis Kelamin', sel.gender === 'L' ? 'Laki-laki' : 'Perempuan'], ['Agama', sel.religion], ['Asal Sekolah', sel.origin_school], ['Alasan Pindah', sel.transfer_reason || '-'], ['Orang Tua', `${sel.parent_name} (${sel.parent_occupation || '-'})`], ['Kontak', `${sel.parent_phone} · ${sel.parent_email || '-'}`], ['Alamat', sel.address], ['Didaftarkan', fmtDateTime(sel.created_at)], ['Biaya Pendaftaran', regBill(sel)?.status === 'lunas' ? 'Lunas' : 'Belum lunas']].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-slate-100 py-1.5"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </div>
            {canManage && sel.status !== 'daftar_ulang' && (
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="mb-3 font-semibold">Proses Seleksi</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nilai Tes / Observasi"><Input type="number" value={form.test_score} onChange={(e) => setForm({ ...form, test_score: e.target.value })} /></Field>
                  <Field label="Catatan"><Textarea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sel.status === 'baru' && <Button variant="secondary" onClick={() => setStatusTo('verifikasi')}><ClipboardCheck className="h-4 w-4" /> Berkas Terverifikasi</Button>}
                  {sel.status !== 'diterima' && <Button variant="success" onClick={() => { if (regBill(sel)?.status !== 'lunas') return toast.error('Biaya pendaftaran belum lunas'); setStatusTo('diterima'); }}><CheckCircle2 className="h-4 w-4" /> Terima</Button>}
                  {sel.status !== 'ditolak' && <Button variant="danger" onClick={() => setStatusTo('ditolak')}><XCircle className="h-4 w-4" /> Tolak</Button>}
                </div>
              </div>
            )}
            {canManage && sel.status === 'diterima' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-1 font-semibold text-emerald-800">Daftar Ulang & Penempatan Kelas</p>
                <p className="mb-3 text-emerald-700">Sistem akan membuat data siswa, akun siswa & orang tua, serta tagihan uang pangkal.</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Kelas Tujuan" className="w-56"><Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} placeholder="- Pilih kelas -" options={selClasses.map((c) => ({ value: c.id, label: c.name }))} /></Field>
                  <Button disabled={!form.class_id} onClick={() => run(async () => { const r = await api.action('ppdb.enroll', { applicant_id: sel.id, class_id: Number(form.class_id) }); setSel(null); setEnrolled(r); })}>Proses Daftar Ulang</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!enrolled} onClose={() => setEnrolled(null)} title="Daftar Ulang Berhasil" size="sm" footer={<Button onClick={() => setEnrolled(null)}>Selesai</Button>}>
        {enrolled && (
          <div className="space-y-2 text-sm">
            <p>Siswa telah terdaftar dan akun dibuat:</p>
            <p className="rounded bg-slate-50 p-2">Akun siswa: <b>{enrolled.username}</b></p>
            <p className="rounded bg-slate-50 p-2">Akun orang tua: <b>{enrolled.parent_username}</b></p>
            <p className="rounded bg-slate-50 p-2">Password awal: <b>{enrolled.password}</b></p>
          </div>
        )}
      </Modal>
    </>
  );
}
