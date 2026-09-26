'use client';
import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useData } from '@/lib/api';
import { useWorkspace } from '@/lib/auth';
import { Button, Card, Input, Loading, PageHeader, ProgressBar, StatCard } from '@/components/ui';
import { BarsChart, DonutChart } from '@/components/charts';
import { indexBy, sortClasses } from '@/lib/scope';
import { isVerified } from '@/lib/finance';
import { compactRupiah, downloadCSV, periodLabel, round, rupiah, today } from '@/lib/utils';

export default function LaporanPage() {
  const { unitId } = useWorkspace();
  const { data } = useData(['payments', 'bills', 'students', 'applicants', 'classes', 'fee_types', 'units', 'expenses']);
  const [year, setYear] = useState(today().slice(0, 4));

  const r = useMemo(() => {
    if (!data) return null;
    const st = indexBy(data.students);
    const ap = indexBy(data.applicants);
    const fees = indexBy(data.fee_types);
    const unitOf = (b: { student_id: number | null; applicant_id: number | null }) => (b.student_id ? st.get(b.student_id)?.unit_id : ap.get(b.applicant_id || 0)?.unit_id);
    const bills = data.bills.filter((b) => !unitId || unitOf(b) === unitId);
    const billIdx = indexBy(bills);
    const pays = data.payments.filter((p) => isVerified(p) && billIdx.has(p.bill_id) && (p.verified_at || p.paid_at).startsWith(year)).map((p) => ({ ...p, paid_at: p.verified_at || p.paid_at }));

    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const monthly = months.map((m) => ({ label: periodLabel(m).slice(0, 3), value: pays.filter((p) => p.paid_at.startsWith(m)).reduce((a, p) => a + p.amount, 0) }));
    const cats = ['bulanan', 'pendaftaran', 'ujian', 'kegiatan', 'denda', 'lainnya'];
    const catLabel: Record<string, string> = { bulanan: 'SPP Bulanan', pendaftaran: 'Pendaftaran & Pangkal', ujian: 'Ujian', kegiatan: 'Kegiatan', denda: 'Denda Perpustakaan', lainnya: 'Lainnya' };
    const byCat = cats.map((c) => ({ name: catLabel[c], value: pays.filter((p) => fees.get(billIdx.get(p.bill_id)!.fee_type_id)?.category === c).reduce((a, p) => a + p.amount, 0) })).filter((x) => x.value > 0);
    const byUnit = data.units.map((u) => {
      const ub = data.bills.filter((b) => unitOf(b) === u.id);
      const target = ub.reduce((a, b) => a + b.amount - b.discount, 0);
      const paid = ub.reduce((a, b) => a + b.paid_amount, 0);
      return { label: u.code, Terbayar: paid, Piutang: target - paid };
    });
    const classes = data.classes.filter((c) => !unitId || c.unit_id === unitId).sort(sortClasses).map((c) => {
      const cb = bills.filter((b) => b.student_id && st.get(b.student_id)?.class_id === c.id);
      const target = cb.reduce((a, b) => a + b.amount - b.discount, 0);
      const paid = cb.reduce((a, b) => a + b.paid_amount, 0);
      const arrearsStudents = new Set(cb.filter((b) => b.status !== 'lunas' && b.due_date < today()).map((b) => b.student_id)).size;
      return { c, target, paid, pct: target ? (paid / target) * 100 : 0, arrearsStudents };
    });
    const target = bills.reduce((a, b) => a + b.amount - b.discount, 0);
    const paid = bills.reduce((a, b) => a + b.paid_amount, 0);
    const discount = bills.reduce((a, b) => a + b.discount, 0);
    const exps = data.expenses.filter((e) => e.date.startsWith(year) && (!unitId || e.unit_id === unitId || e.unit_id === null));
    const cashflow = months.map((m) => {
      const masuk = pays.filter((p) => p.paid_at.startsWith(m)).reduce((a, p) => a + p.amount, 0);
      const keluar = exps.filter((e) => e.date.startsWith(m)).reduce((a, e) => a + e.amount, 0);
      return { m, label: periodLabel(m).slice(0, 3), Penerimaan: masuk, Pengeluaran: keluar };
    });
    let saldo = 0;
    const cashTable = cashflow.filter((c) => c.Penerimaan || c.Pengeluaran).map((c) => ({ ...c, net: c.Penerimaan - c.Pengeluaran, saldo: (saldo += c.Penerimaan - c.Pengeluaran) }));
    const expenseTotal = exps.reduce((a, e) => a + e.amount, 0);
    return { monthly, byCat, byUnit, classes, target, paid, discount, yearTotal: pays.reduce((a, p) => a + p.amount, 0), cashflow, cashTable, expenseTotal };
  }, [data, unitId, year]);

  if (!data || !r) return <Loading />;
  return (
    <>
      <PageHeader title="Laporan Keuangan" subtitle="Rekapitulasi penerimaan, piutang, dan tingkat pelunasan" actions={<>
        <Input type="number" className="w-24" value={year} onChange={(e) => setYear(e.target.value)} />
        <Button variant="secondary" onClick={() => downloadCSV(`laporan-keuangan-${year}.csv`, [['Kelas', 'Total Tagihan', 'Terbayar', 'Piutang', '% Lunas', 'Siswa Menunggak'], ...r.classes.map((x) => [x.c.name, x.target, x.paid, x.target - x.paid, round(x.pct, 1), x.arrearsStudents])])}><Download className="h-4 w-4" /> CSV</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>
      </>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`Penerimaan ${year}`} value={compactRupiah(r.yearTotal)} tone="green" />
        <StatCard label="Total Tagihan" value={compactRupiah(r.target)} tone="blue" />
        <StatCard label="Piutang" value={compactRupiah(r.target - r.paid)} tone="red" hint={`${round(r.target ? ((r.target - r.paid) / r.target) * 100 : 0, 1)}% dari tagihan`} />
        <StatCard label="Potongan / Beasiswa" value={compactRupiah(r.discount)} tone="violet" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Penerimaan per Bulan ${year}`} className="lg:col-span-2"><BarsChart data={r.monthly} bars={[{ key: 'value', name: 'Penerimaan' }]} format={(v) => compactRupiah(v).replace('Rp ', '')} /></Card>
        <Card title="Komposisi Penerimaan"><DonutChart data={r.byCat} format={(v) => compactRupiah(v)} /></Card>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Arus Kas ${year}: Penerimaan vs Pengeluaran`} className="lg:col-span-2">
          <BarsChart data={r.cashflow} bars={[{ key: 'Penerimaan', name: 'Penerimaan' }, { key: 'Pengeluaran', name: 'Pengeluaran' }]} format={(v) => compactRupiah(v).replace('Rp ', '')} />
        </Card>
        <Card title="Ringkasan Arus Kas" bodyClass="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Bulan</th><th className="text-right">Selisih</th><th className="pr-4 text-right">Saldo</th></tr></thead>
            <tbody>
              {r.cashTable.map((c) => (
                <tr key={c.m} className="border-b border-slate-100">
                  <td className="px-4 py-2">{periodLabel(c.m)}</td>
                  <td className={`text-right font-medium ${c.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{c.net >= 0 ? '+' : '−'}{compactRupiah(Math.abs(c.net))}</td>
                  <td className="pr-4 text-right font-semibold">{c.saldo < 0 ? '−' : ''}{compactRupiah(Math.abs(c.saldo))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-slate-500">Total pengeluaran {year}: <b>{rupiah(r.expenseTotal)}</b>. Detail di menu Pengeluaran.</p>
        </Card>
      </div>
      <Card title="Terbayar vs Piutang per Unit" className="mb-4"><BarsChart data={r.byUnit} bars={[{ key: 'Terbayar', name: 'Terbayar' }, { key: 'Piutang', name: 'Piutang' }]} stacked format={(v) => compactRupiah(v).replace('Rp ', '')} /></Card>
      <Card title="Tingkat Pelunasan per Kelas" bodyClass="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Kelas</th><th className="text-right">Tagihan</th><th className="text-right">Terbayar</th><th className="text-right">Piutang</th><th className="w-48 px-4">Pelunasan</th><th className="pr-4 text-right">Menunggak</th></tr></thead>
          <tbody>
            {r.classes.map((x) => (
              <tr key={x.c.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">{x.c.name}</td>
                <td className="text-right">{rupiah(x.target)}</td>
                <td className="text-right text-emerald-600">{rupiah(x.paid)}</td>
                <td className="text-right text-red-600">{rupiah(x.target - x.paid)}</td>
                <td className="px-4"><div className="flex items-center gap-2"><ProgressBar value={x.pct} tone={x.pct >= 85 ? 'green' : x.pct >= 70 ? 'amber' : 'red'} /><span className="w-12 text-right text-xs">{round(x.pct, 0)}%</span></div></td>
                <td className="pr-4 text-right">{x.arrearsStudents} siswa</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
