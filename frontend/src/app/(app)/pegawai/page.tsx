'use client';
import { useMemo, useState } from 'react';
import { Briefcase, Download, GraduationCap, Pencil, Plus, UserCog, Users } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, DataTable, Loading, PageHeader, SearchInput, Select, StatCard, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy } from '@/lib/scope';
import { downloadCSV } from '@/lib/utils';
import type { Employee } from '@/lib/types';

export default function PegawaiPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['employees', 'units', 'classes', 'schedules', 'subjects']);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [edit, setEdit] = useState<Partial<Employee> | null>(null);
  const rows = useMemo(() => (data?.employees || []).filter((e) => (!unitId || e.unit_id === unitId || e.unit_id === null) && (!type || e.type === type) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.nip.includes(q))), [data, unitId, type, q]);
  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const emp = indexBy(data.employees);
  const canEdit = user?.role === 'admin';
  const subjectsOf = (id: number) => [...new Set(data.schedules.filter((s) => s.teacher_id === id).map((s) => data.subjects.find((x) => x.id === s.subject_id)?.code))].join(', ');
  const homeroomOf = (id: number) => data.classes.filter((c) => c.homeroom_id === id).map((c) => c.name).join(', ');

  const cols: Column<Employee>[] = [
    { key: 'name', header: 'Nama', render: (e) => (<div className="flex items-center gap-2"><Avatar name={e.name} className="h-8 w-8" /><div><p className="font-medium">{e.name}</p><p className="font-mono text-[11px] text-slate-500">{e.nip}</p></div></div>) },
    { key: 'position', header: 'Jabatan', render: (e) => (<div><p>{e.position}</p>{homeroomOf(e.id) && <p className="text-xs text-slate-500">Wali kelas {homeroomOf(e.id)}</p>}</div>) },
    { key: 'unit_id', header: 'Unit', render: (e) => <Badge tone="blue">{e.unit_id ? units.get(e.unit_id)?.code : 'Yayasan'}</Badge> },
    { key: 'type', header: 'Jenis', render: (e) => <Badge tone={e.type === 'guru' ? 'green' : e.type === 'pimpinan' ? 'violet' : 'slate'}>{e.type}</Badge> },
    { key: 'mapel', header: 'Mapel', render: (e) => <span className="text-xs">{subjectsOf(e.id) || '-'}</span> },
    { key: 'status', header: 'Status' },
    { key: 'education', header: 'Pendidikan' },
    { key: 'supervisor_id', header: 'Atasan', render: (e) => <span className="text-xs">{emp.get(e.supervisor_id || 0)?.name || '-'}</span> },
    { key: 'a', header: '', render: (e) => canEdit && <Button size="sm" variant="ghost" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button> },
  ];

  const all = data.employees.filter((e) => !unitId || e.unit_id === unitId || e.unit_id === null);
  return (
    <>
      <PageHeader title="Data Guru & Pegawai" subtitle="Kepegawaian yayasan dan unit sekolah" actions={<>
        <Button variant="secondary" onClick={() => downloadCSV('pegawai.csv', [['NIP', 'Nama', 'Jabatan', 'Unit', 'Jenis', 'Status', 'Pendidikan', 'HP', 'Email', 'Mulai Bertugas'], ...rows.map((e) => [e.nip, e.name, e.position, e.unit_id ? units.get(e.unit_id)?.code : 'Yayasan', e.type, e.status, e.education, e.phone, e.email, e.join_date])])}><Download className="h-4 w-4" /> CSV</Button>
        {canEdit && <Button onClick={() => setEdit({ type: 'guru', status: 'GTY', unit_id: unitId || null, is_active: true, gender: 'L' })}><Plus className="h-4 w-4" /> Tambah Pegawai</Button>}
      </>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Pegawai" value={all.length} icon={Users} tone="blue" />
        <StatCard label="Guru" value={all.filter((e) => e.type === 'guru').length} icon={GraduationCap} tone="green" />
        <StatCard label="Pimpinan" value={all.filter((e) => e.type === 'pimpinan').length} icon={UserCog} tone="violet" />
        <StatCard label="Tenaga Kependidikan" value={all.filter((e) => e.type === 'tendik').length} icon={Briefcase} tone="amber" />
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Cari nama / NIP" />
          <Select className="w-44" value={type} onChange={(e) => setType(e.target.value)} placeholder="Semua jenis" options={[{ value: 'guru', label: 'Guru' }, { value: 'pimpinan', label: 'Pimpinan' }, { value: 'tendik', label: 'Tenaga Kependidikan' }]} />
        </div>
        <DataTable rows={rows} columns={cols} />
      </Card>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Pegawai' : 'Tambah Pegawai'} initial={edit || undefined}
        fields={[
          { name: 'name', label: 'Nama Lengkap & Gelar', required: true, full: true },
          { name: 'nip', label: 'NIP / NIY', required: true },
          { name: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }] },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Yayasan (lintas unit)' },
          { name: 'type', label: 'Jenis', type: 'select', options: [{ value: 'guru', label: 'Guru' }, { value: 'pimpinan', label: 'Pimpinan' }, { value: 'tendik', label: 'Tenaga Kependidikan' }], required: true },
          { name: 'position', label: 'Jabatan', required: true },
          { name: 'supervisor_id', label: 'Atasan Langsung', type: 'select', options: data.employees.filter((e) => e.type === 'pimpinan' || e.position.startsWith('Kepala')).map((e) => ({ value: e.id, label: `${e.name} - ${e.position}` })) },
          { name: 'status', label: 'Status Kepegawaian', type: 'select', options: ['PNS', 'PPPK', 'GTY', 'GTT', 'PTY', 'Honorer'].map((x) => ({ value: x, label: x })) },
          { name: 'education', label: 'Pendidikan Terakhir', type: 'select', options: ['SMA', 'D3', 'S1', 'S2', 'S3'].map((x) => ({ value: x, label: x })) },
          { name: 'phone', label: 'No. HP' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'join_date', label: 'Mulai Bertugas', type: 'date' },
          { name: 'is_active', label: 'Aktif', type: 'checkbox' },
        ]}
        onSubmit={(v) => run(async () => {
          if (v.id) await api.update('employees', v.id, v);
          else await api.create('employees', { phone: '', email: '', education: 'S1', join_date: new Date().toISOString().slice(0, 10), ...v });
          setEdit(null);
        }, 'Data pegawai disimpan')} />
    </>
  );
}
