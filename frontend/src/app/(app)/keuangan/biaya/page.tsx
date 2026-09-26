'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Loading, PageHeader, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy } from '@/lib/scope';
import { rupiah } from '@/lib/utils';
import type { FeeType } from '@/lib/types';

const CAT_TONE = { bulanan: 'blue', pendaftaran: 'violet', ujian: 'amber', kegiatan: 'green', lainnya: 'slate' } as const;

export default function BiayaPage() {
  const { unitId } = useWorkspace();
  const { data } = useData(['fee_types', 'units', 'bills']);
  const [edit, setEdit] = useState<Partial<FeeType> | null>(null);
  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const rows = data.fee_types.filter((f) => !unitId || !f.unit_id || f.unit_id === unitId);
  const used = (id: number) => data.bills.filter((b) => b.fee_type_id === id).length;
  const cols: Column<FeeType>[] = [
    { key: 'name', header: 'Nama Biaya', render: (f) => <div><p className="font-medium">{f.name}</p><p className="text-xs text-slate-500">{f.description}</p></div> },
    { key: 'unit_id', header: 'Unit', render: (f) => <Badge tone="blue">{f.unit_id ? units.get(f.unit_id)?.code : 'Semua'}</Badge> },
    { key: 'category', header: 'Kategori', render: (f) => <Badge tone={CAT_TONE[f.category]}>{f.category}</Badge> },
    { key: 'amount', header: 'Nominal', className: 'text-right', render: (f) => <b>{rupiah(f.amount)}</b> },
    { key: 'used', header: 'Dipakai', render: (f) => `${used(f.id)} tagihan` },
    { key: 'a', header: '', render: (f) => (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEdit(f)}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => (used(f.id) ? run(async () => { throw new Error('Jenis biaya sudah dipakai pada tagihan'); }) : confirm('Hapus?') && run(() => api.remove('fee_types', f.id), 'Dihapus'))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    ) },
  ];
  return (
    <>
      <PageHeader title="Jenis Biaya" subtitle="Master biaya: SPP bulanan, pendaftaran, uang pangkal, ujian, kegiatan, dan lainnya" actions={<Button onClick={() => setEdit({ unit_id: unitId || null, category: 'bulanan' })}><Plus className="h-4 w-4" /> Tambah Biaya</Button>} />
      <Card><DataTable rows={rows} columns={cols} pageSize={30} /></Card>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Jenis Biaya' : 'Tambah Jenis Biaya'} initial={edit || undefined} size="md"
        fields={[
          { name: 'name', label: 'Nama Biaya', required: true, full: true },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Semua unit' },
          { name: 'category', label: 'Kategori', type: 'select', options: ['bulanan', 'pendaftaran', 'ujian', 'kegiatan', 'lainnya'].map((c) => ({ value: c, label: c })), required: true },
          { name: 'amount', label: 'Nominal (Rp)', type: 'number', required: true },
          { name: 'description', label: 'Keterangan', full: true },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('fee_types', v.id, v); else await api.create('fee_types', { description: '', ...v }); setEdit(null); }, 'Jenis biaya disimpan')} />
    </>
  );
}
