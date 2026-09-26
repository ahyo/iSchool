'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Loading, PageHeader, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy } from '@/lib/scope';
import type { Subject } from '@/lib/types';

export default function MapelPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['subjects', 'units', 'schedules', 'employees']);
  const [edit, setEdit] = useState<Partial<Subject> | null>(null);
  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const emp = indexBy(data.employees);
  const rows = data.subjects.filter((s) => !unitId || s.unit_id === unitId);
  const teachersOf = (id: number) => [...new Set(data.schedules.filter((s) => s.subject_id === id).map((s) => s.teacher_id))].map((t) => emp.get(t)?.name.split(',')[0]).join(', ');
  const hours = (id: number) => data.schedules.filter((s) => s.subject_id === id).length * 2;
  const canEdit = user?.role === 'admin';

  const cols: Column<Subject>[] = [
    { key: 'unit_id', header: 'Unit', render: (s) => <Badge tone="blue">{units.get(s.unit_id)?.code}</Badge>, sortValue: (s) => s.unit_id },
    { key: 'code', header: 'Kode', className: 'font-mono text-xs' },
    { key: 'name', header: 'Mata Pelajaran', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'group', header: 'Kelompok' },
    { key: 'kkm', header: 'KKM/KKTP' },
    { key: 'jp', header: 'JP/minggu (total)', render: (s) => hours(s.id) },
    { key: 'guru', header: 'Guru Pengampu', render: (s) => <span className="text-xs">{teachersOf(s.id) || '-'}</span> },
    { key: 'a', header: '', render: (s) => canEdit && (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEdit(s)}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => confirm(`Hapus ${s.name}?`) && run(() => api.remove('subjects', s.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    ) },
  ];
  return (
    <>
      <PageHeader title="Mata Pelajaran" subtitle="Struktur kurikulum per unit (Kurikulum Merdeka)" actions={canEdit && <Button onClick={() => setEdit({ unit_id: unitId || undefined, kkm: 75, group: 'Umum' })}><Plus className="h-4 w-4" /> Tambah Mapel</Button>} />
      <Card><DataTable rows={rows} columns={cols} pageSize={20} /></Card>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Mapel' : 'Tambah Mapel'} initial={edit || undefined} size="md"
        fields={[
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), required: true },
          { name: 'code', label: 'Kode', required: true },
          { name: 'name', label: 'Nama Mata Pelajaran', required: true, full: true },
          { name: 'group', label: 'Kelompok', type: 'select', options: ['Umum', 'Pilihan', 'Kejuruan', 'Muatan Lokal'].map((x) => ({ value: x, label: x })) },
          { name: 'kkm', label: 'KKM / KKTP', type: 'number' },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('subjects', v.id, v); else await api.create('subjects', v); setEdit(null); }, 'Mapel disimpan')} />
    </>
  );
}
