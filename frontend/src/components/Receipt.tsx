'use client';
import { Printer } from 'lucide-react';
import { useData } from '@/lib/api';
import { Button, Modal } from './ui';
import { fmtDateTime, rupiah } from '@/lib/utils';
import type { Payment } from '@/lib/types';

function terbilang(n: number): string {
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  n = Math.floor(n);
  if (n < 12) return s[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh ' + terbilang(n % 10);
  if (n < 200) return 'seratus ' + terbilang(n - 100);
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus ' + terbilang(n % 100);
  if (n < 2000) return 'seribu ' + terbilang(n - 1000);
  if (n < 1e6) return terbilang(Math.floor(n / 1000)) + ' ribu ' + terbilang(n % 1000);
  if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta ' + terbilang(n % 1e6);
  return terbilang(Math.floor(n / 1e9)) + ' miliar ' + terbilang(n % 1e9);
}

export function ReceiptModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { data } = useData(['bills', 'students', 'classes', 'applicants', 'settings', 'units']);
  if (!payment || !data) return null;
  const bill = data.bills.find((b) => b.id === payment.bill_id);
  const st = data.students.find((s) => s.id === payment.student_id);
  const ap = data.applicants.find((a) => a.id === payment.applicant_id);
  const unit = data.units.find((u) => u.id === (st?.unit_id || ap?.unit_id));
  const cls = data.classes.find((c) => c.id === st?.class_id);
  const remaining = bill ? bill.amount - bill.discount - bill.paid_amount : 0;
  return (
    <Modal open onClose={onClose} title="Kwitansi Pembayaran" footer={<Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>}>
      <div className="print-area text-sm">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <p className="font-bold">{data.settings[0].foundation}</p>
            <p className="text-xs text-slate-500">{unit?.name} · {data.settings[0].address}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">KWITANSI</p>
            <p className="font-mono text-xs">{payment.receipt_no}</p>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          {[
            ['Telah terima dari', st ? `${st.name} (NIS ${st.nis}, Kelas ${cls?.name || '-'})` : ap ? `${ap.name} (${ap.reg_no})` : '-'],
            ['Untuk pembayaran', bill?.description || '-'],
            ['Metode', payment.method],
            ['Tanggal', fmtDateTime(payment.paid_at)],
            ['Terbilang', <span key="t" className="italic capitalize">{terbilang(payment.amount).replace(/\s+/g, ' ').trim()} rupiah</span>],
          ].map(([k, v]) => (
            <div key={k as string} className="flex gap-3"><span className="w-36 shrink-0 text-slate-500">{k}</span><span className="font-medium">: {v}</span></div>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="rounded-lg border-2 border-slate-800 px-4 py-2 text-xl font-bold">{rupiah(payment.amount)}</div>
          <div className="text-center text-xs">
            <p>Penerima,</p>
            <div className="h-10" />
            <p className="font-semibold">{payment.received_by}</p>
          </div>
        </div>
        {bill && <p className="mt-4 text-xs text-slate-500">Status tagihan: {bill.status === 'lunas' ? 'LUNAS' : `sisa ${rupiah(remaining)}`}</p>}
      </div>
    </Modal>
  );
}
