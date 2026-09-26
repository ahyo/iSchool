'use client';
import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useData } from '@/lib/api';
import { useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Input, Loading, PageHeader, SearchInput, Select, StatCard, type Column } from '@/components/ui';
import { ReceiptModal } from '@/components/Receipt';
import { indexBy } from '@/lib/scope';
import { addDays, compactRupiah, downloadCSV, fmtDateTime, rupiah, today } from '@/lib/utils';
import type { Payment } from '@/lib/types';

export default function PembayaranPage() {
  const { unitId } = useWorkspace();
  const { data } = useData(['payments', 'bills', 'students', 'applicants', 'classes', 'fee_types']);
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const st = useMemo(() => indexBy(data?.students), [data]);
  const ap = useMemo(() => indexBy(data?.applicants), [data]);
  const rows = useMemo(() => (data?.payments || []).filter((p) => {
    const d = p.paid_at.slice(0, 10);
    if (d < from || d > to) return false;
    if (method && p.method !== method) return false;
    const u = p.student_id ? st.get(p.student_id)?.unit_id : ap.get(p.applicant_id || 0)?.unit_id;
    if (unitId && u !== unitId) return false;
    if (q) {
      const t = q.toLowerCase();
      const n = p.student_id ? st.get(p.student_id)?.name : ap.get(p.applicant_id || 0)?.name;
      if (!(n?.toLowerCase().includes(t) || p.receipt_no.toLowerCase().includes(t))) return false;
    }
    return true;
  }).sort((a, b) => b.paid_at.localeCompare(a.paid_at)), [data, from, to, method, q, unitId, st, ap]);
  if (!data) return <Loading />;
  const bills = indexBy(data.bills);
  const cls = indexBy(data.classes);
  const fees = indexBy(data.fee_types);
  const total = rows.reduce((a, p) => a + p.amount, 0);
  const byMethod = ['Tunai', 'Transfer Bank', 'Virtual Account', 'QRIS'].map((m) => ({ m, v: rows.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0) }));

  const cols: Column<Payment>[] = [
    { key: 'receipt_no', header: 'No. Kwitansi', className: 'font-mono text-xs' },
    { key: 'paid_at', header: 'Waktu', render: (p) => fmtDateTime(p.paid_at) },
    { key: 'name', header: 'Pembayar', render: (p) => { const s = st.get(p.student_id || 0); return s ? <div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{cls.get(s.class_id || 0)?.name}</p></div> : <div><p className="font-medium">{ap.get(p.applicant_id || 0)?.name}</p><p className="text-xs text-slate-500">Pendaftar PPDB</p></div>; } },
    { key: 'bill', header: 'Untuk', render: (p) => <span className="text-xs">{fees.get(bills.get(p.bill_id)?.fee_type_id || 0)?.name} · {bills.get(p.bill_id)?.period}</span> },
    { key: 'method', header: 'Metode', render: (p) => <Badge tone={p.method === 'Tunai' ? 'slate' : 'blue'}>{p.method}</Badge> },
    { key: 'amount', header: 'Jumlah', className: 'text-right', render: (p) => <b className="text-emerald-600">{rupiah(p.amount)}</b> },
    { key: 'received_by', header: 'Petugas', render: (p) => <span className="text-xs">{p.received_by}</span> },
    { key: 'a', header: '', render: (p) => <Button size="sm" variant="ghost" onClick={() => setReceipt(p)}><Printer className="h-4 w-4" /></Button> },
  ];

  return (
    <>
      <PageHeader title="Pembayaran" subtitle="Jurnal penerimaan kas dari siswa dan pendaftar" actions={<Button variant="secondary" onClick={() => downloadCSV(`pembayaran-${from}-${to}.csv`, [['No Kwitansi', 'Waktu', 'NIS', 'Nama', 'Tagihan', 'Metode', 'Jumlah', 'Petugas'], ...rows.map((p) => [p.receipt_no, p.paid_at, st.get(p.student_id || 0)?.nis, st.get(p.student_id || 0)?.name || ap.get(p.applicant_id || 0)?.name, bills.get(p.bill_id)?.description, p.method, p.amount, p.received_by])])}><Download className="h-4 w-4" /> CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Penerimaan" value={compactRupiah(total)} tone="green" hint={`${rupiah(total)} · ${rows.length} transaksi`} />
        {byMethod.map((x) => <StatCard key={x.m} label={x.m} value={compactRupiah(x.v)} tone="slate" hint={rupiah(x.v)} />)}
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Cari nama / no. kwitansi" />
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-400">s/d</span>
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select className="w-44" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Semua metode" options={['Tunai', 'Transfer Bank', 'Virtual Account', 'QRIS'].map((m) => ({ value: m, label: m }))} />
        </div>
        <DataTable rows={rows} columns={cols} pageSize={20} />
      </Card>
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
