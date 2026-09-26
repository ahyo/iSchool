'use client';
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus, Send, XCircle } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Tabs, Textarea, run } from '@/components/ui';
import { addDays, fmtDate, fmtDateTime, isWeekend, today } from '@/lib/utils';
import type { LeaveRequest } from '@/lib/types';

const STATUS: Record<LeaveRequest['status'], { tone: 'amber' | 'green' | 'red'; label: string }> = {
  menunggu: { tone: 'amber', label: 'Menunggu' },
  disetujui: { tone: 'green', label: 'Disetujui' },
  ditolak: { tone: 'red', label: 'Ditolak' },
};

function schoolDays(a: string, b: string) {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) if (!isWeekend(d)) n++;
  return n;
}

/** Pengajuan izin/sakit online oleh orang tua/siswa dan persetujuan wali kelas. */
export default function IzinPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { student, employee, children } = useProfile();
  const { data } = useData(['leave_requests', 'students', 'classes']);
  const [tab, setTab] = useState<'menunggu' | 'riwayat'>('menunggu');
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [review, setReview] = useState<{ lr: LeaveRequest; status: 'disetujui' | 'ditolak'; note: string } | null>(null);
  const isFamily = user?.role === 'siswa' || user?.role === 'ortu';

  const list = useMemo(() => {
    if (!data || !user) return [];
    const st = new Map(data.students.map((s) => [s.id, s]));
    let r = data.leave_requests;
    if (isFamily) {
      const ids = new Set(user.role === 'ortu' ? children.map((c) => c.id) : [student?.id]);
      r = r.filter((x) => ids.has(x.student_id));
    } else if (user.role === 'guru') {
      const own = new Set(data.classes.filter((c) => c.homeroom_id === employee?.id).map((c) => c.id));
      r = r.filter((x) => own.has(st.get(x.student_id)?.class_id || 0));
    } else if (unitId) r = r.filter((x) => st.get(x.student_id)?.unit_id === unitId);
    return [...r].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data, user, isFamily, children, student, employee, unitId]);

  if (!data || !user) return <Loading />;
  const stIdx = new Map(data.students.map((s) => [s.id, s]));
  const clsName = (id?: number | null) => data.classes.find((c) => c.id === id)?.name || '-';
  const pending = list.filter((x) => x.status === 'menunggu');
  const shown = tab === 'menunggu' ? pending : list.filter((x) => x.status !== 'menunggu');
  const canReview = !isFamily && (user.role !== 'guru' || data.classes.some((c) => c.homeroom_id === employee?.id)) && user.role !== 'kepsek';
  const childOpts = user.role === 'ortu' ? children : student ? [student] : [];

  const submit = () => run(async () => {
    await api.action('leave.submit', form);
    setForm(null);
    setTab('menunggu');
  }, 'Pengajuan terkirim ke wali kelas');

  return (
    <>
      <PageHeader
        title="Izin & Sakit"
        subtitle={isFamily ? 'Ajukan izin/sakit secara online; presensi otomatis terisi setelah disetujui wali kelas' : 'Persetujuan pengajuan izin/sakit dari orang tua & siswa'}
        actions={isFamily && <Button onClick={() => setForm({ student_id: String(student?.id || childOpts[0]?.id || ''), type: 'S', start_date: today(), end_date: today(), reason: '', attachment_url: '' })}><Plus className="h-4 w-4" /> Ajukan Izin/Sakit</Button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatCard label="Menunggu" value={pending.length} icon={Clock} tone="amber" />
        <StatCard label="Disetujui" value={list.filter((x) => x.status === 'disetujui').length} icon={CheckCircle2} tone="green" />
        <StatCard label="Ditolak" value={list.filter((x) => x.status === 'ditolak').length} icon={XCircle} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'menunggu', label: `Menunggu (${pending.length})` }, { value: 'riwayat', label: 'Riwayat' }]} />
      <div className="space-y-3">
        {shown.map((lr) => {
          const st = stIdx.get(lr.student_id);
          return (
            <Card key={lr.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${lr.type === 'S' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{lr.type}</div>
                <div className="min-w-[220px] flex-1">
                  <p className="font-semibold">{st?.name} <span className="font-normal text-slate-500">· {clsName(st?.class_id)}</span></p>
                  <p className="text-sm">{lr.type === 'S' ? 'Sakit' : 'Izin'} · {fmtDate(lr.start_date)}{lr.end_date !== lr.start_date && ` – ${fmtDate(lr.end_date)}`} <span className="text-slate-500">({schoolDays(lr.start_date, lr.end_date)} hari sekolah)</span></p>
                  <p className="mt-1 text-sm text-slate-700">“{lr.reason}”</p>
                  {lr.attachment_url && <a href={lr.attachment_url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">Lihat lampiran</a>}
                  <p className="mt-1 text-xs text-slate-500">Diajukan oleh {lr.submitted_by} · {fmtDateTime(lr.created_at)}</p>
                  {lr.status !== 'menunggu' && <p className="mt-1 text-xs text-slate-500">Diproses {lr.reviewed_by} · {fmtDateTime(lr.reviewed_at)}{lr.review_note && ` — “${lr.review_note}”`}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={STATUS[lr.status].tone}>{STATUS[lr.status].label}</Badge>
                  {lr.status === 'menunggu' && canReview && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="success" onClick={() => setReview({ lr, status: 'disetujui', note: '' })}><CheckCircle2 className="h-4 w-4" /> Setujui</Button>
                      <Button size="sm" variant="danger" onClick={() => setReview({ lr, status: 'ditolak', note: '' })}><XCircle className="h-4 w-4" /> Tolak</Button>
                    </div>
                  )}
                  {lr.status === 'menunggu' && lr.user_id === user.id && <Button size="sm" variant="ghost" onClick={() => confirm('Batalkan pengajuan?') && run(() => api.action('leave.cancel', { id: lr.id }), 'Pengajuan dibatalkan')}>Batalkan</Button>}
                </div>
              </div>
            </Card>
          );
        })}
        {!shown.length && <Card><Empty text={tab === 'menunggu' ? 'Tidak ada pengajuan yang menunggu' : 'Belum ada riwayat'} /></Card>}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title="Ajukan Izin / Sakit" footer={<><Button variant="secondary" onClick={() => setForm(null)}>Batal</Button><Button onClick={submit}><Send className="h-4 w-4" /> Kirim</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            {childOpts.length > 1 && <Field label="Anak" className="sm:col-span-2"><Select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} options={childOpts.map((c) => ({ value: c.id, label: `${c.name} (${clsName(c.class_id)})` }))} /></Field>}
            <Field label="Jenis" className="sm:col-span-2"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'S', label: 'Sakit' }, { value: 'I', label: 'Izin (keperluan keluarga, dll.)' }]} /></Field>
            <Field label="Dari Tanggal" required><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} /></Field>
            <Field label="Sampai Tanggal" required><Input type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Alasan" required className="sm:col-span-2"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Contoh: demam, istirahat sesuai anjuran dokter" /></Field>
            <Field label="Tautan Lampiran (surat dokter, dll.)" className="sm:col-span-2" hint="Opsional — tautan Google Drive/foto"><Input value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      <Modal open={!!review} onClose={() => setReview(null)} title={review?.status === 'disetujui' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'} size="sm" footer={<Button variant={review?.status === 'disetujui' ? 'success' : 'danger'} onClick={() => run(async () => { const r = await api.action<{ days: number }>('leave.review', { id: review!.lr.id, status: review!.status, note: review!.note }); setReview(null); return r; }, review?.status === 'disetujui' ? 'Disetujui — presensi siswa telah diperbarui' : 'Pengajuan ditolak')}>Konfirmasi</Button>}>
        {review && (
          <div className="space-y-3 text-sm">
            <p><b>{stIdx.get(review.lr.student_id)?.name}</b> · {review.lr.type === 'S' ? 'Sakit' : 'Izin'} {fmtDate(review.lr.start_date)}{review.lr.end_date !== review.lr.start_date && ` – ${fmtDate(review.lr.end_date)}`}</p>
            {review.status === 'disetujui' && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Presensi siswa pada hari sekolah dalam rentang tanggal tersebut akan otomatis tercatat sebagai <b>{review.lr.type === 'S' ? 'Sakit' : 'Izin'}</b>.</p>}
            <Field label="Catatan untuk orang tua (opsional)"><Textarea value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
