'use client';
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Download, ExternalLink, Printer, XCircle } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Empty, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, StatCard, Tabs, Textarea, run, type Column } from '@/components/ui';
import { ReceiptModal } from '@/components/Receipt';
import { indexBy } from '@/lib/scope';
import { isVerified } from '@/lib/finance';
import { addDays, compactRupiah, downloadCSV, fmtDateTime, rupiah, today } from '@/lib/utils';
import type { Payment } from '@/lib/types';

export default function PembayaranPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['payments', 'bills', 'students', 'applicants', 'classes', 'fee_types']);
  const [tab, setTab] = useState<'verifikasi' | 'jurnal' | 'ditolak'>('verifikasi');
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [reject, setReject] = useState<{ p: Payment; reason: string } | null>(null);
  const canVerify = user?.role === 'admin' || user?.role === 'keuangan';
  const st = useMemo(() => indexBy(data?.students), [data]);
  const ap = useMemo(() => indexBy(data?.applicants), [data]);
  const inScope = (p: Payment) => {
    const u = p.student_id ? st.get(p.student_id)?.unit_id : ap.get(p.applicant_id || 0)?.unit_id;
    if (unitId && u !== unitId) return false;
    if (q) {
      const t = q.toLowerCase();
      const n = p.student_id ? st.get(p.student_id)?.name : ap.get(p.applicant_id || 0)?.name;
      if (!(n?.toLowerCase().includes(t) || (p.receipt_no || '').toLowerCase().includes(t) || p.reference.toLowerCase().includes(t))) return false;
    }
    return true;
  };
  const rows = useMemo(() => (data?.payments || []).filter((p) => {
    if (!isVerified(p)) return false;
    const d = (p.verified_at || p.paid_at).slice(0, 10);
    if (d < from || d > to) return false;
    if (method && p.method !== method) return false;
    return inScope(p);
  }).sort((a, b) => (b.verified_at || b.paid_at).localeCompare(a.verified_at || a.paid_at)), [data, from, to, method, q, unitId, st, ap]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading />;
  const pending = data.payments.filter((p) => p.status === 'menunggu' && inScope(p)).sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const rejected = data.payments.filter((p) => p.status === 'ditolak' && inScope(p)).sort((a, b) => (b.verified_at || '').localeCompare(a.verified_at || ''));
  const bills = indexBy(data.bills);
  const cls = indexBy(data.classes);
  const fees = indexBy(data.fee_types);
  const total = rows.reduce((a, p) => a + p.amount, 0);
  const byMethod = ['Tunai', 'Transfer Bank', 'Virtual Account', 'QRIS'].map((m) => ({ m, v: rows.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0) }));
  const payer = (p: Payment) => { const s = st.get(p.student_id || 0); return s ? { name: s.name, sub: cls.get(s.class_id || 0)?.name || s.nis } : { name: ap.get(p.applicant_id || 0)?.name || '-', sub: `Pendaftar PPDB · ${ap.get(p.applicant_id || 0)?.reg_no || ''}` }; };
  const forWhat = (p: Payment) => <span className="text-xs">{fees.get(bills.get(p.bill_id)?.fee_type_id || 0)?.name} · {bills.get(p.bill_id)?.period}</span>;

  const cols: Column<Payment>[] = [
    { key: 'receipt_no', header: 'No. Kwitansi', className: 'font-mono text-xs', render: (p) => p.receipt_no },
    { key: 'paid_at', header: 'Waktu', render: (p) => fmtDateTime(p.verified_at || p.paid_at) },
    { key: 'name', header: 'Pembayar', render: (p) => { const w = payer(p); return <div><p className="font-medium">{w.name}</p><p className="text-xs text-slate-500">{w.sub}</p></div>; } },
    { key: 'bill', header: 'Untuk', render: forWhat },
    { key: 'method', header: 'Metode', render: (p) => <Badge tone={p.method === 'Tunai' ? 'slate' : 'blue'}>{p.method}</Badge> },
    { key: 'amount', header: 'Jumlah', className: 'text-right', render: (p) => <b className="text-emerald-600">{rupiah(p.amount)}</b> },
    { key: 'verified_by', header: 'Diverifikasi', render: (p) => <span className="text-xs">{p.verified_by || p.received_by}</span> },
    { key: 'a', header: '', render: (p) => <Button size="sm" variant="ghost" onClick={() => setReceipt(p)}><Printer className="h-4 w-4" /></Button> },
  ];

  const queueRow = (p: Payment, actions: boolean) => {
    const w = payer(p);
    const bill = bills.get(p.bill_id);
    const remaining = bill ? bill.amount - bill.discount - bill.paid_amount : 0;
    return (
      <div key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
        <div className="min-w-[200px] flex-1">
          <p className="font-semibold">{w.name} <span className="font-normal text-slate-500">· {w.sub}</span></p>
          <p className="text-slate-600">{bill?.description} · sisa tagihan {rupiah(remaining)}</p>
          <p className="text-xs text-slate-500">Dikirim {fmtDateTime(p.paid_at)} · {p.method}{p.reference && <> · ref <span className="font-mono">{p.reference}</span></>}{p.proof_url && <> · <a href={p.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-600 hover:underline">bukti <ExternalLink className="h-3 w-3" /></a></>}</p>
          {!actions && p.reject_reason && <p className="text-xs text-red-600">Ditolak {p.verified_by}: {p.reject_reason}</p>}
        </div>
        <span className="text-lg font-bold">{rupiah(p.amount)}</span>
        {actions && canVerify && (
          <div className="flex gap-1">
            <Button size="sm" variant="success" onClick={() => run(() => api.action('payments.verify', { id: p.id }), 'Pembayaran diverifikasi — kwitansi terbit')}><CheckCircle2 className="h-4 w-4" /> Verifikasi</Button>
            <Button size="sm" variant="danger" onClick={() => setReject({ p, reason: '' })}><XCircle className="h-4 w-4" /> Tolak</Button>
          </div>
        )}
        {!actions && <Badge tone="red">Ditolak</Badge>}
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Pembayaran" subtitle="Verifikasi pembayaran online dan jurnal penerimaan kas" actions={<Button variant="secondary" onClick={() => downloadCSV(`pembayaran-${from}-${to}.csv`, [['No Kwitansi', 'Waktu', 'NIS', 'Nama', 'Tagihan', 'Metode', 'Referensi', 'Jumlah', 'Diverifikasi'], ...rows.map((p) => [p.receipt_no, p.verified_at || p.paid_at, st.get(p.student_id || 0)?.nis, payer(p).name, bills.get(p.bill_id)?.description, p.method, p.reference, p.amount, p.verified_by])])}><Download className="h-4 w-4" /> CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Menunggu Verifikasi" value={pending.length} icon={Clock} tone="amber" hint={rupiah(pending.reduce((a, p) => a + p.amount, 0))} />
        <StatCard label="Penerimaan (filter)" value={compactRupiah(total)} tone="green" hint={`${rupiah(total)} · ${rows.length} transaksi`} />
        {byMethod.map((x) => <StatCard key={x.m} label={x.m} value={compactRupiah(x.v)} tone="slate" hint={rupiah(x.v)} />)}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'verifikasi', label: `Menunggu Verifikasi (${pending.length})` }, { value: 'jurnal', label: 'Jurnal Penerimaan' }, { value: 'ditolak', label: `Ditolak (${rejected.length})` }]} />
      {tab === 'verifikasi' && (
        <Card bodyClass="p-0" title="Pembayaran online menunggu verifikasi" actions={<SearchInput value={q} onChange={setQ} placeholder="Cari nama / referensi" />}>
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">Cocokkan nominal & nomor referensi dengan mutasi rekening/laporan payment gateway sebelum memverifikasi. Tagihan baru dianggap lunas setelah diverifikasi.</p>
          <div className="divide-y divide-slate-100">{pending.map((p) => queueRow(p, true))}</div>
          {!pending.length && <Empty text="Tidak ada pembayaran yang menunggu verifikasi" />}
        </Card>
      )}
      {tab === 'jurnal' && (
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
      )}
      {tab === 'ditolak' && (
        <Card bodyClass="p-0">
          <div className="divide-y divide-slate-100">{rejected.map((p) => queueRow(p, false))}</div>
          {!rejected.length && <Empty text="Tidak ada pembayaran yang ditolak" />}
        </Card>
      )}
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
      <Modal open={!!reject} onClose={() => setReject(null)} title="Tolak Pembayaran" size="sm" footer={<Button variant="danger" onClick={() => run(async () => { await api.action('payments.reject', { id: reject!.p.id, reason: reject!.reason }); setReject(null); }, 'Pembayaran ditolak')}>Tolak</Button>}>
        {reject && (
          <div className="space-y-3 text-sm">
            <p><b>{payer(reject.p).name}</b> · {rupiah(reject.p.amount)} · {reject.p.method} {reject.p.reference && `(${reject.p.reference})`}</p>
            <Field label="Alasan penolakan (dikirim ke pembayar)"><Textarea value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} placeholder="Contoh: dana belum masuk ke rekening sekolah / nominal tidak sesuai" /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
