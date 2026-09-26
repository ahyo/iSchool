'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, CreditCard, Printer, ShieldCheck, XCircle } from 'lucide-react';
import { api, useData } from '@/lib/api';
import type { ExamPeriod, Student } from '@/lib/types';
import type { Requirement } from '@/lib/examcard';
import { cn, fmtDate, rupiah } from '@/lib/utils';
import { Avatar, Badge, Button, Card, Loading } from './ui';

export interface CardInfo {
  applicable: boolean;
  eligible: boolean;
  requirements: Requirement[];
  dispensation: { reason: string; granted_by: string } | null;
  period: ExamPeriod;
  class_name: string;
  room: string;
  seat: number;
  payload: string | null;
}

export async function qrDataUrl(text: string, size = 220) {
  const QR = await import('qrcode');
  return QR.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
}

export function QRImage({ text, size = 180 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    qrDataUrl(text, size * 2).then(setSrc);
  }, [text, size]);
  return src ? <img src={src} alt="QR kartu ujian" width={size} height={size} className="rounded-md" /> : <div style={{ width: size, height: size }} className="animate-pulse rounded-md bg-slate-100" />;
}

export function RequirementList({ items }: { items: Requirement[] }) {
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.key} className="flex items-start gap-2 text-sm">
          {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
          <span className="flex-1"><span className="font-medium">{r.label}</span> <span className="text-slate-500">— {r.detail}</span></span>
          {r.outstanding > 0 && <span className="font-semibold text-red-600">{rupiah(r.outstanding)}</span>}
        </li>
      ))}
      {!items.length && <li className="text-sm text-slate-500">Tidak ada persyaratan administrasi.</li>}
    </ul>
  );
}

/** Cetak satu atau banyak kartu ujian di jendela terpisah (A4, 2 kolom). */
export async function printCards(cards: { student: Student; info: CardInfo }[], schoolName: string, unitName: (id: number) => string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const blocks = await Promise.all(cards.filter((c) => c.info.payload).map(async ({ student, info }) => `
    <div class="card">
      <div class="head"><div><b>${esc(schoolName)}</b><br><span>${esc(unitName(student.unit_id))}</span></div><div class="tag">KARTU PESERTA UJIAN</div></div>
      <div class="title">${esc(info.period.name)}</div>
      <div class="body">
        <table>
          <tr><td>Nama</td><td>: <b>${esc(student.name)}</b></td></tr>
          <tr><td>NIS / NISN</td><td>: ${esc(student.nis)} / ${esc(student.nisn)}</td></tr>
          <tr><td>Kelas</td><td>: ${esc(info.class_name)}</td></tr>
          <tr><td>Ruang / Kursi</td><td>: ${esc(info.room)} / No. ${info.seat}</td></tr>
          <tr><td>Pelaksanaan</td><td>: ${esc(fmtDate(info.period.start_date))} – ${esc(fmtDate(info.period.end_date))}</td></tr>
        </table>
        <img src="${await qrDataUrl(info.payload!, 300)}" />
      </div>
      <div class="foot">Tunjukkan kartu ini kepada pengawas. ${esc(info.period.notes || '')}</div>
    </div>`));
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Kartu Ujian</title><style>
    body{font-family:Arial,sans-serif;margin:12mm;color:#0f172a} .grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
    .card{border:1.5px solid #1e293b;border-radius:8px;padding:10px;page-break-inside:avoid;font-size:11px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:6px}
    .tag{background:#1d4ed8;color:#fff;padding:3px 6px;border-radius:4px;font-weight:bold;font-size:10px}
    .title{text-align:center;font-weight:bold;margin:6px 0} .body{display:flex;justify-content:space-between;gap:8px;align-items:center}
    td{padding:2px 4px 2px 0;vertical-align:top} img{width:105px;height:105px} .foot{margin-top:6px;font-size:9px;color:#475569}
  </style></head><body><div class="grid">${blocks.join('')}</div><script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}

/** Kartu ujian satu siswa (atau daftar syarat yang belum terpenuhi). */
export function ExamCardView({ student, period, schoolName, unitName }: { student: Student; period: ExamPeriod; schoolName: string; unitName: string }) {
  const [info, setInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState('');
  // Ambil ulang kartu hanya bila tagihan/dispensasi berubah (mis. setelah pembayaran)
  const { data: deps } = useData(['bills', 'exam_dispensations', 'payments']);
  const waitingTotal = (deps?.payments || []).filter((p) => p.student_id === student.id && p.status === 'menunggu').reduce((a, p) => a + p.amount, 0);
  useEffect(() => {
    api.action<CardInfo>('examcard.get', { period_id: period.id, student_id: student.id }).then(setInfo).catch((e) => setError(e.message));
  }, [period.id, student.id, deps]);
  if (error) return <Card><p className="text-sm text-red-600">{error}</p></Card>;
  if (!info) return <Loading />;
  if (!info.applicable) return null;

  if (!info.eligible) {
    const total = info.requirements.reduce((a, r) => a + r.outstanding, 0);
    return (
      <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> {period.name}</span>}>
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Kartu ujian belum dapat diterbitkan</p>
          <p className="mt-1">Selesaikan persyaratan berikut. Kartu ber-QR akan muncul otomatis setelah pembayaran terkonfirmasi.</p>
        </div>
        <div className="mt-4"><RequirementList items={info.requirements} /></div>
        {waitingTotal > 0 && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Ada pembayaran {rupiah(waitingTotal)} yang sedang <b>menunggu verifikasi</b> bagian keuangan. Kartu terbit otomatis setelah pembayaran diverifikasi.</p>}
        {total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
            <span className="text-sm">Total yang perlu dilunasi: <b className="text-red-600">{rupiah(total)}</b></span>
            <Link href="/keuangan/tagihan/"><Button size="sm"><CreditCard className="h-4 w-4" /> Bayar Tagihan</Button></Link>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Butuh keringanan? Hubungi bagian keuangan untuk pengajuan dispensasi.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-900 px-5 py-4 text-white">
          <div><p className="text-xs uppercase tracking-wider text-brand-100">{schoolName}</p><p className="font-bold">{unitName}</p></div>
          <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-bold tracking-wide">KARTU PESERTA UJIAN</span>
        </div>
        <p className="border-b border-slate-200 px-5 py-2 text-center text-sm font-semibold">{period.name}</p>
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start">
          <Avatar name={student.name} className="h-20 w-20 text-2xl" />
          <table className="flex-1 text-sm">
            <tbody>
              {[['Nama', student.name], ['NIS / NISN', `${student.nis} / ${student.nisn}`], ['Kelas', info.class_name], ['Ruang / Kursi', `${info.room} / No. ${info.seat}`], ['Pelaksanaan', `${fmtDate(period.start_date)} – ${fmtDate(period.end_date)}`]].map(([k, v]) => (
                <tr key={k}><td className="py-1 pr-3 text-slate-500">{k}</td><td className="py-1 font-medium">{v}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="text-center">
            <QRImage text={info.payload!} size={150} />
            <p className="mt-1 font-mono text-[10px] text-slate-400">{info.payload!.split(':').slice(-1)[0]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 bg-emerald-50 px-5 py-2.5 text-xs text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> Terverifikasi: {info.dispensation ? `dispensasi (${info.dispensation.reason})` : 'seluruh persyaratan administrasi terpenuhi'}. Tunjukkan QR kepada pengawas.
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <Button variant="secondary" onClick={() => printCards([{ student, info }], schoolName, () => unitName)}><Printer className="h-4 w-4" /> Cetak Kartu</Button>
      </div>
    </div>
  );
}

/** Pemindai QR menggunakan kamera (getUserMedia + jsQR). */
export function QRScanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const last = useRef({ text: '', at: 0 });
  const cb = useRef(onResult);
  cb.current = onResult;

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    (async () => {
      try {
        const jsQR = (await import('jsqr')).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stop) return;
          const c = canvasRef.current;
          if (c && v.videoWidth) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            const now = Date.now();
            if (code?.data && !pausedRef.current && (code.data !== last.current.text || now - last.current.at > 8000)) {
              last.current = { text: code.data, at: now };
              cb.current(code.data);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setErr((e as Error).name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan akses kamera di browser, atau gunakan input NIS.' : 'Kamera tidak tersedia di perangkat ini. Gunakan input NIS.');
        setOn(false);
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  return (
    <div>
      <div className={cn('relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900', !on && 'bg-slate-100')}>
        <video ref={videoRef} playsInline muted className={cn('h-full w-full object-cover', !on && 'hidden')} />
        <canvas ref={canvasRef} className="hidden" />
        {on && <div className="pointer-events-none absolute inset-[18%] rounded-xl border-4 border-white/80" />}
        {!on && <div className="p-6 text-center text-sm text-slate-500"><Camera className="mx-auto mb-2 h-8 w-8" />Aktifkan kamera lalu arahkan ke QR pada kartu ujian</div>}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <Button className="mt-3 w-full" variant={on ? 'secondary' : 'primary'} onClick={() => { setErr(''); setOn(!on); }}>{on ? <><CameraOff className="h-4 w-4" /> Matikan Kamera</> : <><Camera className="h-4 w-4" /> Aktifkan Kamera</>}</Button>
    </div>
  );
}

export function EligibleBadge({ ok, dispensed }: { ok: boolean; dispensed?: boolean }) {
  return ok ? <Badge tone="green">{dispensed ? 'Layak (dispensasi)' : 'Kartu terbit'}</Badge> : <Badge tone="red">Belum memenuhi</Badge>;
}
