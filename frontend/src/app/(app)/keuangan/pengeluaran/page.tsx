'use client';
import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Trash2, TrendingDown, Wallet } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Input, Loading, PageHeader, SearchInput, Select, StatCard, run, type Column } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { DonutChart } from '@/components/charts';
import { compactRupiah, downloadCSV, fmtDate, nowISO, rupiah, today } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@/lib/types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Gaji & Honor', 'Operasional', 'ATK & Bahan Ajar', 'Pemeliharaan', 'Kegiatan Siswa', 'Utilitas', 'Lainnya'];

export default function PengeluaranPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['expenses', 'units', 'payments']);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const canEdit = user?.role === 'admin' || user?.role === 'keuangan';
  const scoped = useMemo(() => (data?.expenses || []).filter((e) => !unitId || e.unit_id === unitId || e.unit_id === null), [data, unitId]);
  if (!data) return <Loading />;
  const rows = scoped.filter((e) => (!month || e.date.startsWith(month)) && (!category || e.category === category) && (!q || e.description.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((a, e) => a + e.amount, 0);
  const income = data.payments.filter((p) => p.paid_at.startsWith(month)).reduce((a, p) => a + p.amount, 0);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ name: c, value: rows.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const unitCode = (id: number | null) => (id ? data.units.find((u) => u.id === id)?.code : 'Yayasan');

  const cols: Column<Expense>[] = [
    { key: 'date', header: 'Tanggal', render: (e) => fmtDate(e.date) },
    { key: 'description', header: 'Uraian', render: (e) => <div><p className="font-medium">{e.description}</p>{e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">Bukti</a>}</div> },
    { key: 'category', header: 'Kategori', render: (e) => <Badge tone="slate">{e.category}</Badge> },
    { key: 'unit', header: 'Unit', render: (e) => <Badge tone="blue">{unitCode(e.unit_id)}</Badge> },
    { key: 'method', header: 'Metode' },
    { key: 'amount', header: 'Jumlah', className: 'text-right', sortValue: (e) => e.amount, render: (e) => <b className="text-red-600">{rupiah(e.amount)}</b> },
    { key: 'recorded_by', header: 'Dicatat', render: (e) => <span className="text-xs">{e.recorded_by}</span> },
    { key: 'a', header: '', render: (e) => canEdit && (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => confirm('Hapus pengeluaran?') && run(() => api.remove('expenses', e.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Pengeluaran" subtitle="Pencatatan kas keluar: gaji, operasional, pemeliharaan, kegiatan, dan lainnya" actions={<>
        <Button variant="secondary" onClick={() => downloadCSV(`pengeluaran-${month || 'semua'}.csv`, [['Tanggal', 'Uraian', 'Kategori', 'Unit', 'Metode', 'Jumlah', 'Dicatat'], ...rows.map((e) => [e.date, e.description, e.category, unitCode(e.unit_id), e.method, e.amount, e.recorded_by])])}><Download className="h-4 w-4" /> CSV</Button>
        {canEdit && <Button onClick={() => setEdit({ date: today(), category: 'Operasional', method: 'Transfer Bank', unit_id: unitId || null })}><Plus className="h-4 w-4" /> Catat Pengeluaran</Button>}
      </>} />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4">
          <StatCard label="Total Pengeluaran (filter)" value={compactRupiah(total)} icon={TrendingDown} tone="red" hint={`${rupiah(total)} · ${rows.length} transaksi`} />
          <StatCard label={`Penerimaan ${month || ''}`} value={compactRupiah(income)} icon={Wallet} tone="green" hint={month ? `Selisih ${income - total >= 0 ? '+' : '−'}${compactRupiah(Math.abs(income - total))}` : 'Pilih bulan untuk melihat selisih'} />
        </div>
        <Card title="Komposisi per Kategori" className="lg:col-span-2">{byCat.length ? <DonutChart data={byCat} format={(v) => compactRupiah(v)} /> : <p className="py-10 text-center text-sm text-slate-400">Tidak ada data</p>}</Card>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Cari uraian" />
          <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Select className="w-48" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Semua kategori" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          {month && <Button variant="ghost" size="sm" onClick={() => setMonth('')}>Semua bulan</Button>}
        </div>
        <DataTable rows={rows} columns={cols} pageSize={20} empty="Belum ada pengeluaran" />
      </Card>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'} initial={edit || undefined}
        fields={[
          { name: 'date', label: 'Tanggal', type: 'date', required: true },
          { name: 'category', label: 'Kategori', type: 'select', options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })), required: true },
          { name: 'description', label: 'Uraian', required: true, full: true },
          { name: 'amount', label: 'Jumlah (Rp)', type: 'number', required: true },
          { name: 'method', label: 'Metode', type: 'select', options: [{ value: 'Tunai', label: 'Tunai' }, { value: 'Transfer Bank', label: 'Transfer Bank' }] },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Yayasan (lintas unit)' },
          { name: 'receipt_url', label: 'Tautan Bukti / Nota', full: true },
        ]}
        onSubmit={(v) => run(async () => {
          if (!v.amount || v.amount <= 0) throw new Error('Jumlah harus lebih dari 0');
          const payload = { ...v, receipt_url: v.receipt_url || '' };
          if (v.id) await api.update('expenses', v.id, payload);
          else await api.create('expenses', { ...payload, recorded_by: user?.name || '', created_at: nowISO() });
          setEdit(null);
        }, 'Pengeluaran disimpan')} />
    </>
  );
}
