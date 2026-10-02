'use client';
import { useMemo, useState } from 'react';
import { Clock, CreditCard, Download, FilePlus2, Layers, Pencil, QrCode, Trash2, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, StatCard, StatusBadge, Tabs, run, toast, type Column } from '@/components/ui';
import { isVerified, payableRemaining, pendingFor } from '@/lib/finance';
import { BankInfo } from '@/components/BankInfo';
import { FormModal } from '@/components/FormModal';
import { ReceiptModal } from '@/components/Receipt';
import { indexBy, sortClasses } from '@/lib/scope';
import { cn, compactRupiah, downloadCSV, fmtDate, fmtDateTime, nowISO, periodLabel, rupiah, today } from '@/lib/utils';
import type { Bill, Payment } from '@/lib/types';

const remaining = (b: Bill) => b.amount - b.discount - b.paid_amount;

export default function TagihanPage() {
  const { user } = useAuth();
  if (user?.role === 'siswa' || user?.role === 'ortu') return <MyBills />;
  return <StaffBills />;
}

/* ================= Siswa / Orang tua ================= */
function MyBills() {
  const { student } = useProfile();
  const { data } = useData(['bills', 'payments', 'fee_types', 'settings']);
  const [tab, setTab] = useState<'tagihan' | 'riwayat'>('tagihan');
  const [pay, setPay] = useState<Bill[] | null>(null);
  const [method, setMethod] = useState<Payment['method']>('Transfer Bank');
  const [ref, setRef] = useState({ reference: '', proof_url: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data || !student) return <Loading />;
  const bills = data.bills.filter((b) => b.student_id === student.id).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const payable = (b: Bill) => payableRemaining(b, data.payments);
  const open = bills.filter((b) => b.status !== 'lunas');
  const payments = data.payments.filter((p) => p.student_id === student.id).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const verified = payments.filter(isVerified);
  const waiting = payments.filter((p) => p.status === 'menunggu');
  const total = open.reduce((a, b) => a + remaining(b), 0);
  const selTotal = open.filter((b) => selected.includes(b.id)).reduce((a, b) => a + payable(b), 0);

  const doPay = async () => {
    if (!pay) return;
    setBusy(true);
    await run(async () => {
      for (const b of pay) await api.action('payments.pay', { bill_id: b.id, amount: payable(b), method, reference: ref.reference, proof_url: ref.proof_url });
      setPay(null);
      setSelected([]);
      setRef({ reference: '', proof_url: '' });
    }, 'Pembayaran terkirim — menunggu verifikasi bagian keuangan');
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Tagihan & Pembayaran" subtitle={`${student.name} · NIS ${student.nis}`} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tagihan Aktif" value={rupiah(total)} icon={Wallet} tone="red" hint={`${open.length} tagihan`} />
        <StatCard label="Menunggu Verifikasi" value={rupiah(waiting.reduce((a, p) => a + p.amount, 0))} icon={Clock} tone="amber" hint={`${waiting.length} pembayaran`} />
        <StatCard label="Sudah Dibayar (terverifikasi)" value={rupiah(verified.reduce((a, p) => a + p.amount, 0))} icon={CheckCircle2} tone="green" />
        <StatCard label="Jatuh Tempo Terlewat" value={open.filter((b) => b.due_date < today()).length} icon={AlertTriangle} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tagihan', label: 'Tagihan' }, { value: 'riwayat', label: `Riwayat Pembayaran${waiting.length ? ` (${waiting.length} menunggu)` : ''}` }]} />
      {tab === 'tagihan' ? (
        <Card actions={selected.length > 0 && <Button onClick={() => setPay(open.filter((b) => selected.includes(b.id) && payable(b) > 0))}><CreditCard className="h-4 w-4" /> Bayar {selected.length} tagihan ({rupiah(selTotal)})</Button>} title="Daftar Tagihan">
          <div className="divide-y divide-slate-100">
            {bills.map((b) => {
              const pend = pendingFor(b.id, data.payments);
              const canPay = b.status !== 'lunas' && payable(b) > 0;
              return (
                <div key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  {canPay ? <input type="checkbox" className="h-4 w-4" checked={selected.includes(b.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, b.id] : selected.filter((x) => x !== b.id))} /> : <span className="w-4" />}
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium">{b.description}</p>
                    <p className={cn('text-xs', b.status !== 'lunas' && b.due_date < today() ? 'text-red-600' : 'text-slate-500')}>Jatuh tempo {fmtDate(b.due_date)}{b.discount > 0 && ` · potongan ${rupiah(b.discount)}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{rupiah(b.status === 'lunas' ? b.amount - b.discount : remaining(b))}</p>
                    {b.status === 'sebagian' && <p className="text-xs text-slate-500">dibayar {rupiah(b.paid_amount)}</p>}
                  </div>
                  {pend.length > 0 ? <Badge tone="amber"><Clock className="mr-1 h-3 w-3" />Menunggu verifikasi</Badge> : <StatusBadge status={b.status} />}
                  {canPay && <Button size="sm" onClick={() => setPay([b])}>Bayar</Button>}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card bodyClass="p-0">
          <div className="divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{data.bills.find((b) => b.id === p.bill_id)?.description}</p>
                  <p className="text-xs text-slate-500">{p.receipt_no ? `${p.receipt_no} · ` : ''}{p.method}{p.reference && ` · ref ${p.reference}`} · {fmtDateTime(p.paid_at)}</p>
                  {p.status === 'ditolak' && <p className="text-xs text-red-600">Ditolak: {p.reject_reason}. Silakan ajukan ulang.</p>}
                </div>
                <span className={cn('font-semibold', p.status === 'ditolak' ? 'text-slate-400 line-through' : 'text-emerald-600')}>{rupiah(p.amount)}</span>
                {p.status === 'menunggu' ? <Badge tone="amber">Menunggu verifikasi</Badge> : p.status === 'ditolak' ? <Badge tone="red">Ditolak</Badge> : <Button size="sm" variant="secondary" onClick={() => setReceipt(p)}>Kwitansi</Button>}
              </div>
            ))}
          </div>
          {!payments.length && <p className="py-8 text-center text-sm text-slate-400">Belum ada pembayaran</p>}
        </Card>
      )}
      <Modal open={!!pay} onClose={() => setPay(null)} title="Pembayaran Online" size="sm" footer={<><Button variant="secondary" onClick={() => setPay(null)}>Batal</Button><Button loading={busy} disabled={method === 'Transfer Bank' && !ref.reference.trim()} onClick={doPay}>Kirim Pembayaran</Button></>}>
        {pay && (
          <>
            <ul className="mb-3 space-y-1 text-sm">{pay.map((b) => <li key={b.id} className="flex justify-between gap-2"><span>{b.description}</span><span>{rupiah(payable(b))}</span></li>)}</ul>
            <p className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{rupiah(pay.reduce((a, b) => a + payable(b), 0))}</span></p>
            <div className="mt-4 space-y-2">
              {(['Transfer Bank', 'Virtual Account', 'QRIS'] as Payment['method'][]).map((m) => (
                <label key={m} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm', method === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
                  <input type="radio" checked={method === m} onChange={() => setMethod(m)} /> {m === 'QRIS' && <QrCode className="h-4 w-4" />} {m}
                </label>
              ))}
            </div>
            {method === 'Transfer Bank' && <BankInfo settings={data.settings[0]} />}
            {method === 'Virtual Account' && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">No. VA: <b className="font-mono">8808 0{student.nis}</b> (BSI/BNI/Mandiri)</p>}
            <div className="mt-3 space-y-3">
              <Field label={method === 'Transfer Bank' ? 'No. referensi / nama pengirim' : 'No. referensi transaksi (opsional)'} required={method === 'Transfer Bank'}><Input value={ref.reference} onChange={(e) => setRef({ ...ref, reference: e.target.value })} placeholder="mis. TRF-BSI-12345 / a.n. Hendra Pratama" /></Field>
              <Field label="Tautan bukti pembayaran (opsional)" hint="Foto/tangkapan layar bukti di Google Drive, dll."><Input value={ref.proof_url} onChange={(e) => setRef({ ...ref, proof_url: e.target.value })} /></Field>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Pembayaran akan diperiksa bagian keuangan. Status tagihan menjadi <b>lunas</b> setelah dana dipastikan masuk dan diverifikasi.</p>
          </>
        )}
      </Modal>
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

/* ================= Staf keuangan ================= */
function StaffBills() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['bills', 'students', 'classes', 'fee_types', 'applicants', 'units', 'payments']);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [classId, setClassId] = useState('');
  const [feeId, setFeeId] = useState('');
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'Tunai' as Payment['method'], note: '' });
  const [gen, setGen] = useState<Record<string, any> | null>(null);
  const [edit, setEdit] = useState<Bill | null>(null);
  const [manual, setManual] = useState<Record<string, any> | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const canEdit = user?.role === 'admin' || user?.role === 'keuangan';

  const st = useMemo(() => indexBy(data?.students), [data]);
  const ap = useMemo(() => indexBy(data?.applicants), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    return data.bills.filter((b) => {
      const s = b.student_id ? st.get(b.student_id) : undefined;
      const a = b.applicant_id ? ap.get(b.applicant_id) : undefined;
      const u = s?.unit_id || a?.unit_id;
      if (unitId && u !== unitId) return false;
      if (status && b.status !== status) return false;
      if (period && b.period !== period) return false;
      if (classId && s?.class_id !== Number(classId)) return false;
      if (feeId && b.fee_type_id !== Number(feeId)) return false;
      if (q) {
        const t = q.toLowerCase();
        if (!(s?.name.toLowerCase().includes(t) || s?.nis.includes(t) || a?.name.toLowerCase().includes(t) || b.description.toLowerCase().includes(t))) return false;
      }
      return true;
    });
  }, [data, st, ap, unitId, status, period, classId, feeId, q]);

  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const fees = indexBy(data.fee_types);
  const periods = [...new Set(data.bills.map((b) => b.period))].sort().reverse();
  const nameOf = (b: Bill) => (b.student_id ? st.get(b.student_id)?.name : `${ap.get(b.applicant_id || 0)?.name} (PPDB)`);
  const totals = { tagihan: rows.reduce((a, b) => a + b.amount - b.discount, 0), terbayar: rows.reduce((a, b) => a + b.paid_amount, 0), sisa: rows.reduce((a, b) => a + remaining(b), 0) };

  const cols: Column<Bill>[] = [
    { key: 'name', header: 'Siswa', sortValue: (b) => nameOf(b) || '', render: (b) => { const s = st.get(b.student_id || 0); return <div><p className="font-medium">{nameOf(b)}</p><p className="text-xs text-slate-500">{s ? `${s.nis} · ${cls.get(s.class_id || 0)?.name || s.status}` : ap.get(b.applicant_id || 0)?.reg_no}</p></div>; } },
    { key: 'description', header: 'Tagihan', render: (b) => <div><p>{fees.get(b.fee_type_id)?.name}</p><p className="text-xs text-slate-500">{periodLabel(b.period)}</p></div> },
    { key: 'amount', header: 'Nominal', className: 'text-right', render: (b) => <div className="text-right"><p>{rupiah(b.amount)}</p>{b.discount > 0 && <p className="text-xs text-emerald-600">-{rupiah(b.discount)}</p>}</div> },
    { key: 'paid_amount', header: 'Dibayar', className: 'text-right', render: (b) => rupiah(b.paid_amount) },
    { key: 'sisa', header: 'Sisa', className: 'text-right', sortValue: remaining, render: (b) => <b className={remaining(b) > 0 ? 'text-red-600' : ''}>{rupiah(remaining(b))}</b> },
    { key: 'due_date', header: 'Jatuh Tempo', render: (b) => <span className={b.status !== 'lunas' && b.due_date < today() ? 'font-semibold text-red-600' : ''}>{fmtDate(b.due_date)}</span> },
    { key: 'status', header: 'Status', render: (b) => (pendingFor(b.id, data.payments).length ? <Badge tone="amber">Menunggu verifikasi</Badge> : <StatusBadge status={b.status} />) },
    { key: 'a', header: '', render: (b) => canEdit && (
      <div className="flex justify-end gap-1">
        {b.status !== 'lunas' && <Button size="sm" onClick={() => { setPayBill(b); setPayForm({ amount: String(remaining(b)), method: 'Tunai', note: '' }); }}>Bayar</Button>}
        <Button size="sm" variant="ghost" onClick={() => setEdit(b)} title="Ubah/diskon"><Pencil className="h-4 w-4" /></Button>
        {b.paid_amount === 0 && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus tagihan?') && run(() => api.remove('bills', b.id), 'Tagihan dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
      </div>
    ) },
  ];

  const classOpts = data.classes.filter((c) => !unitId || c.unit_id === unitId).sort(sortClasses);
  const feeOpts = data.fee_types.filter((f) => !unitId || !f.unit_id || f.unit_id === unitId);

  return (
    <>
      <PageHeader title="Tagihan Siswa" subtitle="SPP bulanan, biaya pendaftaran, ujian, kegiatan, dan lainnya" actions={<>
        <Button variant="secondary" onClick={() => downloadCSV('tagihan.csv', [['NIS', 'Nama', 'Kelas', 'Tagihan', 'Periode', 'Nominal', 'Diskon', 'Dibayar', 'Sisa', 'Jatuh Tempo', 'Status'], ...rows.map((b) => { const s = st.get(b.student_id || 0); return [s?.nis, nameOf(b), cls.get(s?.class_id || 0)?.name, fees.get(b.fee_type_id)?.name, b.period, b.amount, b.discount, b.paid_amount, remaining(b), b.due_date, b.status]; })])}><Download className="h-4 w-4" /> CSV</Button>
        {canEdit && <Button variant="secondary" onClick={() => setManual({ due_date: today(), period: today().slice(0, 7) })}><FilePlus2 className="h-4 w-4" /> Tagihan Perorangan</Button>}
        {canEdit && <Button onClick={() => setGen({ period: today().slice(0, 7), due_date: `${today().slice(0, 7)}-10` })}><Layers className="h-4 w-4" /> Generate Tagihan Massal</Button>}
      </>} />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Tagihan (filter)" value={compactRupiah(totals.tagihan)} tone="blue" hint={`${rupiah(totals.tagihan)} · ${rows.length} tagihan`} />
        <StatCard label="Terbayar" value={compactRupiah(totals.terbayar)} tone="green" hint={rupiah(totals.terbayar)} />
        <StatCard label="Sisa / Piutang" value={compactRupiah(totals.sisa)} tone="red" hint={rupiah(totals.sisa)} />
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Cari nama / NIS / tagihan" />
          <Select className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={classOpts.map((c) => ({ value: c.id, label: c.name }))} />
          <Select className="w-56" value={feeId} onChange={(e) => setFeeId(e.target.value)} placeholder="Semua jenis biaya" options={feeOpts.map((f) => ({ value: f.id, label: f.name }))} />
          <Select className="w-40" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Semua periode" options={periods.map((p) => ({ value: p, label: periodLabel(p) }))} />
          <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Semua status" options={[{ value: 'belum', label: 'Belum bayar' }, { value: 'sebagian', label: 'Sebagian' }, { value: 'lunas', label: 'Lunas' }]} />
        </div>
        <DataTable rows={rows} columns={cols} />
      </Card>

      <Modal open={!!payBill} onClose={() => setPayBill(null)} title="Terima Pembayaran" size="sm" footer={<Button onClick={() => run(async () => { const p = await api.action<Payment>('payments.pay', { bill_id: payBill!.id, amount: Number(payForm.amount), method: payForm.method, note: payForm.note }); setPayBill(null); setReceipt(p); }, 'Pembayaran tercatat')}>Simpan & Cetak Kwitansi</Button>}>
        {payBill && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3"><p className="font-medium">{nameOf(payBill)}</p><p className="text-slate-500">{payBill.description}</p><p className="mt-1">Sisa tagihan: <b>{rupiah(remaining(payBill))}</b></p></div>
            <Field label="Nominal Dibayar" hint="Dapat dicicil (pembayaran sebagian)"><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
            <Field label="Metode"><Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as Payment['method'] })} options={['Tunai', 'Transfer Bank', 'Virtual Account', 'QRIS'].map((m) => ({ value: m, label: m }))} /></Field>
            <Field label="Catatan"><Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <FormModal open={!!gen} onClose={() => setGen(null)} title="Generate Tagihan Massal" initial={gen || undefined} submitLabel="Generate"
        fields={[
          { name: 'fee_type_id', label: 'Jenis Biaya', type: 'select', options: feeOpts.map((f) => ({ value: f.id, label: `${f.name} — ${rupiah(f.amount)}` })), required: true, full: true },
          { name: 'period', label: 'Periode (bulan)', type: 'text', placeholder: 'YYYY-MM', required: true },
          { name: 'due_date', label: 'Jatuh Tempo', type: 'date', required: true },
          { name: 'class_id', label: 'Kelas (opsional)', type: 'select', options: classOpts.map((c) => ({ value: c.id, label: c.name })), placeholder: 'Semua kelas pada unit biaya' },
          { name: 'description', label: 'Keterangan (opsional)' },
        ]}
        onSubmit={(v) => run(async () => { const r = await api.action<{ created: number; skipped: number }>('bills.generate', { ...v, unit_id: unitId || undefined }); setGen(null); toast.success(`${r.created} tagihan dibuat, ${r.skipped} dilewati (sudah ada)`); })} />

      <FormModal open={!!manual} onClose={() => setManual(null)} title="Tagihan Perorangan" initial={manual || undefined}
        fields={[
          { name: 'student_id', label: 'Siswa', type: 'select', options: data.students.filter((s) => s.status === 'aktif' && (!unitId || s.unit_id === unitId)).sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ value: s.id, label: `${s.name} — ${cls.get(s.class_id || 0)?.name}` })), required: true, full: true },
          { name: 'fee_type_id', label: 'Jenis Biaya', type: 'select', options: feeOpts.map((f) => ({ value: f.id, label: `${f.name} — ${rupiah(f.amount)}` })), required: true, full: true },
          { name: 'amount', label: 'Nominal (kosongkan = sesuai jenis biaya)', type: 'number' },
          { name: 'discount', label: 'Potongan / Beasiswa', type: 'number' },
          { name: 'period', label: 'Periode', placeholder: 'YYYY-MM' },
          { name: 'due_date', label: 'Jatuh Tempo', type: 'date' },
          { name: 'description', label: 'Keterangan', full: true },
        ]}
        onSubmit={(v) => run(async () => {
          const f = fees.get(v.fee_type_id)!;
          await api.create('bills', { student_id: v.student_id, applicant_id: null, fee_type_id: f.id, period: v.period, description: v.description || `${f.name} ${v.period}`, amount: v.amount || f.amount, discount: v.discount || 0, paid_amount: 0, due_date: v.due_date, status: 'belum', created_at: nowISO() });
          setManual(null);
        }, 'Tagihan dibuat')} />

      <FormModal open={!!edit} onClose={() => setEdit(null)} title="Ubah Tagihan / Beri Potongan" initial={edit || undefined} size="md"
        fields={[
          { name: 'description', label: 'Keterangan', full: true },
          { name: 'amount', label: 'Nominal', type: 'number' },
          { name: 'discount', label: 'Potongan / Beasiswa', type: 'number' },
          { name: 'due_date', label: 'Jatuh Tempo', type: 'date' },
        ]}
        onSubmit={(v) => run(async () => {
          const net = v.amount - (v.discount || 0);
          await api.update('bills', v.id, { description: v.description, amount: v.amount, discount: v.discount || 0, due_date: v.due_date, status: v.paid_amount >= net ? 'lunas' : v.paid_amount > 0 ? 'sebagian' : 'belum' });
          setEdit(null);
        }, 'Tagihan diperbarui')} />
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
