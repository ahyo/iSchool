'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Search, UserPlus, ArrowLeftRight, CreditCard, Printer } from 'lucide-react';
import { api, useAction } from '@/lib/api';
import { PublicFooter, PublicNav } from '@/components/PublicNav';
import { Badge, Button, Card, Field, Input, Loading, Modal, Select, StatusBadge, Tabs, Textarea, toast } from '@/components/ui';
import { cn, fmtDate, gradeLabel, rupiah } from '@/lib/utils';
import type { Applicant, Bill, Major, Payment, Settings, Unit, FeeType } from '@/lib/types';

interface Portal { settings: Settings; units: Unit[]; majors: Major[]; fee_types: FeeType[] }

const STEPS = ['Jalur & Jenjang', 'Data Calon Siswa', 'Data Orang Tua', 'Konfirmasi'];
const STATUS_FLOW: Applicant['status'][] = ['baru', 'verifikasi', 'diterima', 'daftar_ulang'];
const STATUS_TEXT: Record<string, string> = {
  baru: 'Pendaftaran diterima sistem. Silakan lunasi biaya pendaftaran.',
  verifikasi: 'Berkas sedang diverifikasi dan dijadwalkan tes/observasi.',
  diterima: 'Selamat! Calon siswa dinyatakan DITERIMA. Silakan lakukan daftar ulang di sekolah.',
  daftar_ulang: 'Daftar ulang selesai. Akun siswa & orang tua telah dibuat.',
  ditolak: 'Mohon maaf, pendaftaran belum dapat diterima.',
};

function PayModal({ bill, onClose, onPaid }: { bill: Bill | null; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState<Payment['method']>('Virtual Account');
  const [busy, setBusy] = useState(false);
  if (!bill) return null;
  const remaining = bill.amount - bill.discount - bill.paid_amount;
  return (
    <Modal open onClose={onClose} title="Pembayaran Online" size="sm" footer={<>
      <Button variant="secondary" onClick={onClose}>Batal</Button>
      <Button loading={busy} onClick={async () => {
        setBusy(true);
        try {
          await api.action('ppdb.pay', { bill_id: bill.id, method });
          toast.success('Pembayaran berhasil (simulasi)');
          onPaid();
        } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }}>Bayar {rupiah(remaining)}</Button>
    </>}>
      <p className="text-sm text-slate-600">{bill.description}</p>
      <p className="mt-1 text-2xl font-bold">{rupiah(remaining)}</p>
      <div className="mt-4 space-y-2">
        {(['Virtual Account', 'QRIS', 'Transfer Bank'] as Payment['method'][]).map((m) => (
          <label key={m} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm', method === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
            <input type="radio" checked={method === m} onChange={() => setMethod(m)} /> {m}
          </label>
        ))}
      </div>
      {method === 'Virtual Account' && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">No. VA (simulasi): <b>8808 {String(bill.id).padStart(4, '0')} 2027 0001</b></p>}
      <p className="mt-3 text-xs text-slate-500">Mode demo: pembayaran disimulasikan dan langsung terkonfirmasi. Di mode produksi, integrasikan dengan payment gateway (Midtrans/Xendit) melalui backend.</p>
    </Modal>
  );
}

export default function PPDBPage() {
  const { data } = useAction<Portal>('public.portal');
  const [tab, setTab] = useState<'daftar' | 'status'>('daftar');
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Record<string, any>>({ type: 'baru', gender: 'L', religion: 'Islam' });
  const [result, setResult] = useState<{ applicant: Applicant; bill: Bill | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState({ reg_no: '', birth_date: '' });
  const [status, setStatus] = useState<{ applicant: Applicant; bills: Bill[]; unit: Unit } | null>(null);
  const [payBill, setPayBill] = useState<Bill | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'status') setTab('status');
  }, []);

  if (!data) return (<><PublicNav /><Loading /></>);
  const unit = data.units.find((u) => u.id === Number(f.unit_id));
  const majors = data.majors.filter((m) => m.unit_id === unit?.id);
  const grades = unit ? Array.from({ length: unit.max_grade - unit.min_grade + 1 }, (_, i) => unit.min_grade + i) : [];
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const regFee = data.fee_types.find((x) => x.unit_id === unit?.id && x.category === 'pendaftaran');

  const validate = () => {
    const req: Record<number, string[]> = {
      0: ['type', 'unit_id', 'grade_target'],
      1: ['name', 'gender', 'birth_place', 'birth_date', 'origin_school', 'address'],
      2: ['parent_name', 'parent_phone'],
    };
    if (step === 0 && unit && (unit.code === 'SMK' || (unit.code === 'SMA' && Number(f.grade_target) > 10)) && !f.major_id) return 'Pilih jurusan/peminatan';
    const miss = (req[step] || []).filter((k) => !f[k]);
    return miss.length ? 'Lengkapi semua kolom wajib' : '';
  };

  const next = () => {
    const err = validate();
    if (err) return toast.error(err);
    setStep(step + 1);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.action<{ applicant: Applicant; bill: Bill | null }>('ppdb.register', f);
      setResult(r);
      toast.success('Pendaftaran berhasil dikirim');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const check = async (reg = q.reg_no, bd = q.birth_date) => {
    try {
      setStatus(await api.action('ppdb.status', { reg_no: reg, birth_date: bd }));
    } catch (e) {
      setStatus(null);
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 py-12 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="text-3xl font-bold">Penerimaan Peserta Didik Baru</h1>
          <p className="mt-2 text-brand-100">Tahun Ajaran 2027/2028 · Jalur siswa baru & siswa pindahan · SD, SMP, SMA, SMK</p>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'daftar', label: 'Formulir Pendaftaran' }, { value: 'status', label: 'Cek Status & Pembayaran' }]} />

        {tab === 'daftar' && !data.settings.ppdb_open && <Card><p className="text-center text-slate-600">Pendaftaran saat ini sedang ditutup.</p></Card>}

        {tab === 'daftar' && data.settings.ppdb_open && !result && (
          <Card>
            <ol className="mb-6 flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <li key={s} className={cn('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  <span>{i + 1}</span> {s}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { v: 'baru', icon: UserPlus, t: 'Siswa Baru', d: 'Mendaftar di kelas awal jenjang (kelas 1, 7, atau 10).' },
                    { v: 'pindahan', icon: ArrowLeftRight, t: 'Siswa Pindahan', d: 'Mutasi masuk dari sekolah lain ke kelas yang sesuai.' },
                  ].map((o) => (
                    <button key={o.v} onClick={() => { set('type', o.v); set('grade_target', ''); }} className={cn('flex gap-3 rounded-xl border-2 p-4 text-left', f.type === o.v ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
                      <o.icon className="h-6 w-6 text-brand-600" />
                      <span><span className="block font-semibold">{o.t}</span><span className="text-sm text-slate-500">{o.d}</span></span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Jenjang / Unit" required>
                    <Select value={f.unit_id || ''} onChange={(e) => { const u = data.units.find((x) => x.id === Number(e.target.value)); setF((s) => ({ ...s, unit_id: e.target.value, major_id: '', grade_target: s.type === 'baru' && u ? u.min_grade : '' })); }} placeholder="- Pilih -" options={data.units.map((u) => ({ value: u.id, label: u.name }))} />
                  </Field>
                  <Field label="Kelas Tujuan" required>
                    <Select value={f.grade_target || ''} disabled={f.type === 'baru'} onChange={(e) => set('grade_target', e.target.value)} placeholder="- Pilih -" options={grades.filter((g) => f.type === 'baru' ? g === unit?.min_grade : g > (unit?.min_grade || 0)).map((g) => ({ value: g, label: `Kelas ${gradeLabel(g)}` }))} />
                  </Field>
                  {majors.length > 0 && (
                    <Field label="Jurusan / Peminatan" required={unit?.code === 'SMK' || Number(f.grade_target) > 10}>
                      <Select value={f.major_id || ''} onChange={(e) => set('major_id', e.target.value)} placeholder="- Pilih -" options={majors.map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` }))} />
                    </Field>
                  )}
                </div>
                {regFee && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Biaya pendaftaran {unit?.code}: <b>{rupiah(regFee.amount)}</b> — dibayarkan setelah formulir dikirim.</p>}
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama Lengkap" required><Input value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="NISN" hint="Nomor Induk Siswa Nasional (jika ada)"><Input value={f.nisn || ''} onChange={(e) => set('nisn', e.target.value)} /></Field>
                <Field label="Jenis Kelamin" required><Select value={f.gender} onChange={(e) => set('gender', e.target.value)} options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} /></Field>
                <Field label="Agama" required><Select value={f.religion} onChange={(e) => set('religion', e.target.value)} options={['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((x) => ({ value: x, label: x }))} /></Field>
                <Field label="Tempat Lahir" required><Input value={f.birth_place || ''} onChange={(e) => set('birth_place', e.target.value)} /></Field>
                <Field label="Tanggal Lahir" required><Input type="date" value={f.birth_date || ''} onChange={(e) => set('birth_date', e.target.value)} /></Field>
                <Field label={f.type === 'pindahan' ? 'Sekolah Asal (saat ini)' : 'Sekolah Asal / TK'} required className="sm:col-span-2"><Input value={f.origin_school || ''} onChange={(e) => set('origin_school', e.target.value)} /></Field>
                {f.type === 'pindahan' && <Field label="Alasan Pindah" className="sm:col-span-2"><Textarea value={f.transfer_reason || ''} onChange={(e) => set('transfer_reason', e.target.value)} /></Field>}
                <Field label="Alamat Lengkap" required className="sm:col-span-2"><Textarea value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
                <Field label="Unggah Dokumen" hint="Akta kelahiran, KK, rapor terakhir (demo: tidak diunggah ke server)" className="sm:col-span-2"><Input type="file" multiple /></Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama Orang Tua / Wali" required><Input value={f.parent_name || ''} onChange={(e) => set('parent_name', e.target.value)} /></Field>
                <Field label="Pekerjaan"><Input value={f.parent_occupation || ''} onChange={(e) => set('parent_occupation', e.target.value)} /></Field>
                <Field label="No. HP / WhatsApp" required hint="Digunakan sebagai username akun orang tua"><Input value={f.parent_phone || ''} onChange={(e) => set('parent_phone', e.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={f.parent_email || ''} onChange={(e) => set('parent_email', e.target.value)} /></Field>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ['Jalur', f.type === 'baru' ? 'Siswa Baru' : 'Siswa Pindahan'], ['Unit', unit?.name], ['Kelas Tujuan', `Kelas ${gradeLabel(Number(f.grade_target))}`],
                  ['Jurusan', majors.find((m) => m.id === Number(f.major_id))?.name || '-'], ['Nama', f.name], ['NISN', f.nisn || '-'],
                  ['TTL', `${f.birth_place}, ${fmtDate(f.birth_date)}`], ['Sekolah Asal', f.origin_school], ['Orang Tua', f.parent_name], ['No. HP', f.parent_phone],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-100 py-2"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
                ))}
                <label className="col-span-full mt-4 flex items-start gap-2 text-slate-600">
                  <input type="checkbox" checked={!!f.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-1" />
                  Saya menyatakan data yang diisi adalah benar dan bersedia mengikuti ketentuan PPDB.
                </label>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Kembali</Button>
              {step < 3 ? <Button onClick={next}>Lanjut</Button> : <Button disabled={!f.agree} loading={busy} onClick={submit}>Kirim Pendaftaran</Button>}
            </div>
          </Card>
        )}

        {tab === 'daftar' && result && (
          <Card>
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <h2 className="mt-3 text-xl font-bold">Pendaftaran Berhasil!</h2>
              <p className="mt-1 text-slate-600">Simpan nomor pendaftaran berikut untuk mengecek status.</p>
              <p className="mt-4 inline-block rounded-xl bg-brand-50 px-6 py-3 font-mono text-2xl font-bold text-brand-700">{result.applicant.reg_no}</p>
              {result.bill && (
                <div className="mx-auto mt-6 max-w-sm rounded-xl border border-slate-200 p-4 text-left">
                  <p className="text-sm text-slate-500">Tagihan</p>
                  <p className="font-semibold">{result.bill.description}</p>
                  <p className="text-xl font-bold">{rupiah(result.bill.amount)}</p>
                  {result.bill.status === 'lunas' ? (
                    <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-center text-sm font-semibold text-emerald-700">Lunas — terima kasih!</p>
                  ) : (
                    <Button className="mt-3 w-full" onClick={() => setPayBill(result.bill)}><CreditCard className="h-4 w-4" /> Bayar Sekarang</Button>
                  )}
                </div>
              )}
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => { setTab('status'); setQ({ reg_no: result.applicant.reg_no, birth_date: result.applicant.birth_date }); check(result.applicant.reg_no, result.applicant.birth_date); }}>Cek Status</Button>
                <Button variant="ghost" onClick={() => { setResult(null); setStep(0); setF({ type: 'baru', gender: 'L', religion: 'Islam' }); }}>Daftar Lagi</Button>
              </div>
            </div>
          </Card>
        )}

        {tab === 'status' && (
          <div className="space-y-6">
            <Card>
              <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); check(); }}>
                <Field label="Nomor Pendaftaran"><Input value={q.reg_no} onChange={(e) => setQ({ ...q, reg_no: e.target.value })} placeholder="PPDB-2027-SMA-0001" required /></Field>
                <Field label="Tanggal Lahir"><Input type="date" value={q.birth_date} onChange={(e) => setQ({ ...q, birth_date: e.target.value })} required /></Field>
                <Button type="submit"><Search className="h-4 w-4" /> Cek</Button>
              </form>
            </Card>
            {status && (
              <Card title={<span className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> {status.applicant.name}</span>} actions={<Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak Bukti</Button>}>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">No. Pendaftaran:</span> <b>{status.applicant.reg_no}</b></p>
                  <p><span className="text-slate-500">Unit:</span> {status.unit?.name} · Kelas {gradeLabel(status.applicant.grade_target)}</p>
                  <p><span className="text-slate-500">Jalur:</span> {status.applicant.type === 'baru' ? 'Siswa Baru' : 'Pindahan'}</p>
                  <p><span className="text-slate-500">Status:</span> <StatusBadge status={status.applicant.status} /></p>
                </div>
                {status.applicant.status !== 'ditolak' && (
                  <div className="my-6 flex items-center">
                    {STATUS_FLOW.map((s, i) => {
                      const idx = STATUS_FLOW.indexOf(status.applicant.status);
                      return (
                        <div key={s} className="flex flex-1 items-center">
                          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', i <= idx ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>{i + 1}</div>
                          {i < STATUS_FLOW.length - 1 && <div className={cn('h-1 flex-1', i < idx ? 'bg-emerald-500' : 'bg-slate-200')} />}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{STATUS_TEXT[status.applicant.status]} {status.applicant.notes && `(${status.applicant.notes})`}</p>
                {status.applicant.test_score != null && <p className="mt-2 text-sm">Nilai tes/observasi: <b>{status.applicant.test_score}</b></p>}
                <h4 className="mt-6 font-semibold">Tagihan</h4>
                {status.bills.map((b) => (
                  <div key={b.id} className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                    <div><p className="font-medium">{b.description}</p><p className="text-slate-500">{rupiah(b.amount)} · jatuh tempo {fmtDate(b.due_date)}</p></div>
                    {b.status === 'lunas' ? <Badge tone="green">Lunas</Badge> : <Button size="sm" onClick={() => setPayBill(b)}>Bayar</Button>}
                  </div>
                ))}
                {status.applicant.status === 'daftar_ulang' && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Akun iSchool telah dibuat. Siswa login memakai NIS, orang tua memakai No. HP, password awal <b>demo123</b>. <Link href="/login/" className="font-semibold underline">Masuk</Link></p>}
              </Card>
            )}
            {!status && <p className="text-center text-sm text-slate-500">Contoh data demo: login sebagai Kesiswaan untuk melihat nomor pendaftaran dan tanggal lahir pendaftar.</p>}
          </div>
        )}
      </div>
      <PublicFooter name={data.settings.name} address={data.settings.address} phone={data.settings.phone} email={data.settings.email} />
      <PayModal bill={payBill} onClose={() => setPayBill(null)} onPaid={() => {
        setPayBill(null);
        if (result?.bill) setResult({ ...result, bill: { ...result.bill, status: 'lunas', paid_amount: result.bill.amount } });
        if (status) check(status.applicant.reg_no, status.applicant.birth_date);
      }} />
    </div>
  );
}
