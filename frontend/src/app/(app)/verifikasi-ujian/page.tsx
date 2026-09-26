'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Keyboard, ScanLine, XCircle } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, Select, StatCard } from '@/components/ui';
import { QRScanner, RequirementList } from '@/components/examcard';
import type { Requirement } from '@/lib/examcard';
import { sortClasses, teacherClassIds } from '@/lib/scope';
import { cn, fmtDate, fmtDateTime, today } from '@/lib/utils';

interface VerifyResult {
  valid: boolean;
  reason: string;
  already?: boolean;
  method?: 'qr' | 'manual';
  student: { id: number; name: string; nis: string; class_name: string } | null;
  requirements?: Requirement[];
}

/** Verifikasi kartu ujian oleh pengawas: pindai QR / input NIS, dengan daftar hadir per kelas. */
export default function VerifikasiUjianPage() {
  const { user } = useAuth();
  const { employee } = useProfile();
  const { data } = useData(['exam_periods', 'exam_checkins', 'students', 'classes', 'schedules']);
  const [periodId, setPeriodId] = useState(0);
  const [classId, setClassId] = useState('');
  const [nis, setNis] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !periodId) setPeriodId(data.exam_periods.find((p) => p.is_active)?.id || 0);
  }, [data, periodId]);
  const classes = useMemo(() => {
    if (!data) return [];
    const ids = user?.role === 'guru' ? teacherClassIds(employee?.id, data.schedules, data.classes) : null;
    return data.classes.filter((c) => !ids || ids.has(c.id)).sort(sortClasses);
  }, [data, user, employee]);

  if (!data) return <Loading />;
  const period = data.exam_periods.find((p) => p.id === periodId);
  const verify = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.action<VerifyResult>('examcard.verify', { period_id: periodId, class_id: classId ? Number(classId) : null, ...body });
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.valid ? 80 : [60, 60, 60]);
    } catch (e) {
      setResult({ valid: false, reason: (e as Error).message, student: null });
    } finally {
      setBusy(false);
    }
  };

  const todays = data.exam_checkins.filter((c) => c.period_id === periodId && c.checked_at.slice(0, 10) === today());
  const roster = classId ? data.students.filter((s) => s.class_id === Number(classId) && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name)) : [];
  const statusOf = (sid: number) => {
    const list = todays.filter((c) => c.student_id === sid);
    if (list.some((c) => c.valid)) return 'valid';
    return list.length ? 'ditolak' : 'belum';
  };
  const stName = (id: number) => data.students.find((s) => s.id === id)?.name || '-';

  return (
    <>
      <PageHeader title="Verifikasi Kartu Ujian" subtitle="Pindai QR pada kartu peserta; status administrasi dicek ulang secara langsung" />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Periode Ujian"><Select className="w-80" value={periodId} onChange={(e) => setPeriodId(Number(e.target.value))} options={data.exam_periods.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="Ruang / Kelas (opsional)"><Select className="w-48" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={classes.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        {period && (today() < period.start_date || today() > period.end_date) && <Badge tone="amber" className="mb-2">Di luar jadwal ({fmtDate(period.start_date)} – {fmtDate(period.end_date)})</Badge>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><ScanLine className="h-4 w-4" /> Pindai QR</span>}>
            <QRScanner paused={busy} onResult={(text) => verify({ payload: text })} />
            <form className="mt-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = nis.trim(); if (v) verify(v.toUpperCase().startsWith('ISCHOOL-KU') ? { payload: v } : { nis: v }); }}>
              <Field label="Atau masukkan NIS / tempel isi QR" className="flex-1"><Input value={nis} onChange={(e) => setNis(e.target.value)} placeholder="NIS siswa atau ISCHOOL-KU:..." /></Field>
              <Button type="submit" variant="secondary" loading={busy}><Keyboard className="h-4 w-4" /> Cek</Button>
            </form>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Hasil Verifikasi">
            {result ? (
              <div className={cn('rounded-xl p-5', result.valid ? 'bg-emerald-50' : 'bg-red-50')}>
                <div className="flex items-center gap-3">
                  {result.valid ? <CheckCircle2 className="h-12 w-12 text-emerald-500" /> : <XCircle className="h-12 w-12 text-red-500" />}
                  <div>
                    <p className={cn('text-2xl font-extrabold', result.valid ? 'text-emerald-700' : 'text-red-700')}>{result.valid ? 'BOLEH MENGIKUTI UJIAN' : 'TIDAK VALID'}</p>
                    {!result.valid && <p className="text-sm text-red-700">{result.reason}</p>}
                    {result.valid && result.already && <p className="text-sm text-emerald-700">Sudah diverifikasi sebelumnya hari ini</p>}
                  </div>
                </div>
                {result.student && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg bg-white/70 p-3">
                    <Avatar name={result.student.name} className="h-12 w-12" />
                    <div><p className="font-semibold">{result.student.name}</p><p className="text-sm text-slate-600">NIS {result.student.nis} · Kelas {result.student.class_name} · {result.method === 'manual' ? 'verifikasi manual — cocokkan identitas siswa' : 'QR asli'}</p></div>
                  </div>
                )}
                {result.requirements && result.requirements.length > 0 && <div className="mt-4"><RequirementList items={result.requirements} /></div>}
              </div>
            ) : <Empty text="Belum ada kartu yang diperiksa" />}
          </Card>
          {classId ? (
            <Card title={`Daftar Hadir Ujian · ${data.classes.find((c) => c.id === Number(classId))?.name}`} bodyClass="p-0">
              <div className="grid grid-cols-3 gap-3 p-4">
                <StatCard label="Terverifikasi" value={roster.filter((s) => statusOf(s.id) === 'valid').length} tone="green" />
                <StatCard label="Ditolak" value={roster.filter((s) => statusOf(s.id) === 'ditolak').length} tone="red" />
                <StatCard label="Belum" value={roster.filter((s) => statusOf(s.id) === 'belum').length} tone="slate" />
              </div>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {roster.map((s, i) => {
                  const st = statusOf(s.id);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-6 text-slate-400">{i + 1}</span>
                      <span className="flex-1">{s.name} <span className="text-xs text-slate-400">{s.nis}</span></span>
                      {st === 'valid' ? <Badge tone="green">Terverifikasi</Badge> : st === 'ditolak' ? <Badge tone="red">Ditolak</Badge> : <Button size="sm" variant="ghost" onClick={() => verify({ nis: s.nis })}>Cek manual</Button>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <Card title="Riwayat Pindai Hari Ini" bodyClass="p-0">
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {[...todays].reverse().slice(0, 30).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    {c.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="flex-1">{stName(c.student_id)} <span className="text-xs text-slate-400">· {c.note}</span></span>
                    <span className="text-xs text-slate-400">{fmtDateTime(c.checked_at).split(', ').pop()} · {c.checked_by.split(',')[0]}</span>
                  </li>
                ))}
              </ul>
              {!todays.length && <Empty text="Belum ada pemindaian hari ini" />}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
