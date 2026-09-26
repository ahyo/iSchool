'use client';
import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Printer, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Empty, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, StatCard, Tabs, Textarea, run, type Column } from '@/components/ui';
import { EligibleBadge, ExamCardView, printCards, RequirementList, type CardInfo } from '@/components/examcard';
import { examEligibility } from '@/lib/examcard';
import { indexBy, sortClasses } from '@/lib/scope';
import { fmtDate, periodLabel, rupiah, today } from '@/lib/utils';
import type { ExamPeriod, Student } from '@/lib/types';

const TYPES: ExamPeriod['type'][] = ['PTS', 'PAS', 'PAT', 'US', 'UKK'];

export default function KartuUjianPage() {
  const { user } = useAuth();
  if (!user) return <Loading />;
  return user.role === 'siswa' || user.role === 'ortu' ? <FamilyCards /> : <StaffCards />;
}

function FamilyCards() {
  const { student } = useProfile();
  const { data } = useData(['exam_periods', 'settings', 'units']);
  if (!data || !student) return <Loading />;
  const periods = data.exam_periods.filter((p) => p.is_active && (!p.unit_id || p.unit_id === student.unit_id) && p.end_date >= today());
  const unit = data.units.find((u) => u.id === student.unit_id);
  return (
    <>
      <PageHeader title="Kartu Ujian" subtitle={`${student.name} · kartu peserta ujian dengan QR code untuk verifikasi pengawas`} />
      <div className="space-y-6">
        {periods.map((p) => <ExamCardView key={p.id} student={student} period={p} schoolName={data.settings[0].foundation} unitName={unit?.name || ''} />)}
        {!periods.length && <Card><Empty text="Belum ada periode ujian yang aktif" /></Card>}
      </div>
    </>
  );
}

function StaffCards() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['exam_periods', 'exam_dispensations', 'exam_checkins', 'students', 'classes', 'bills', 'fee_types', 'units', 'settings', 'academic_years']);
  const [tab, setTab] = useState<'peserta' | 'periode'>('peserta');
  const [periodId, setPeriodId] = useState(0);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [editP, setEditP] = useState<Partial<ExamPeriod> | null>(null);
  const [disp, setDisp] = useState<{ student: Student; reason: string } | null>(null);
  const [view, setView] = useState<Student | null>(null);
  const canManage = ['admin', 'keuangan', 'kesiswaan'].includes(user?.role || '');
  const canDispense = ['admin', 'keuangan', 'kepsek'].includes(user?.role || '');

  useEffect(() => {
    if (data && !data.exam_periods.some((p) => p.id === periodId)) setPeriodId(data.exam_periods.find((p) => p.is_active)?.id || data.exam_periods[0]?.id || 0);
  }, [data, periodId]);

  const period = data?.exam_periods.find((p) => p.id === periodId);
  const rows = useMemo(() => {
    if (!data || !period) return [];
    return data.students
      .filter((s) => s.status === 'aktif' && (!unitId || s.unit_id === unitId) && (!classId || s.class_id === Number(classId)))
      .map((s) => ({ ...s, el: examEligibility(data, period, s) }))
      .filter((r) => r.el.applicable)
      .filter((r) => !status || (status === 'layak' ? r.el.eligible : !r.el.eligible))
      .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.nis.includes(q));
  }, [data, period, unitId, classId, status, q]);

  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const unitName = (id: number) => data.units.find((u) => u.id === id)?.name || '';
  const checkedIn = new Set(data.exam_checkins.filter((c) => c.period_id === periodId && c.valid).map((c) => c.student_id));
  type R = (typeof rows)[number];
  const cols: Column<R>[] = [
    { key: 'name', header: 'Siswa', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.nis} · {cls.get(r.class_id || 0)?.name}</p></div> },
    { key: 'status', header: 'Status Kartu', sortValue: (r) => Number(r.el.eligible), render: (r) => <EligibleBadge ok={r.el.eligible} dispensed={!!r.el.dispensation} /> },
    { key: 'kurang', header: 'Kekurangan', render: (r) => <span className="text-xs text-slate-600">{r.el.requirements.filter((x) => !x.ok).map((x) => x.label).join('; ') || '-'}</span> },
    { key: 'tunggakan', header: 'Tunggakan', sortValue: (r) => r.el.requirements.reduce((a, x) => a + x.outstanding, 0), render: (r) => { const t = r.el.requirements.reduce((a, x) => a + x.outstanding, 0); return t ? <b className="text-red-600">{rupiah(t)}</b> : '-'; } },
    { key: 'hadir', header: 'Verifikasi', render: (r) => (checkedIn.has(r.id) ? <Badge tone="blue">Sudah discan</Badge> : <span className="text-xs text-slate-400">-</span>) },
    { key: 'a', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" title="Lihat kartu" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
        {canDispense && !r.el.dispensation && !r.el.eligible && <Button size="sm" variant="secondary" onClick={() => setDisp({ student: r, reason: '' })}><ShieldCheck className="h-4 w-4" /> Dispensasi</Button>}
        {canDispense && r.el.dispensation && <Button size="sm" variant="ghost" title="Cabut dispensasi" onClick={() => confirm('Cabut dispensasi?') && run(() => api.action('examcard.revokeDispensation', { id: r.el.dispensation!.id }), 'Dispensasi dicabut')}><ShieldOff className="h-4 w-4 text-red-500" /></Button>}
      </div>
    ) },
  ];

  const all = rows;
  const eligible = all.filter((r) => r.el.eligible);
  const bulkPrint = () => run(async () => {
    if (!classId) throw new Error('Pilih kelas terlebih dahulu untuk cetak massal');
    const cards = await Promise.all(eligible.map(async (s) => ({ student: s as Student, info: await api.action<CardInfo>('examcard.get', { period_id: periodId, student_id: s.id }) })));
    await printCards(cards, data.settings[0].foundation, unitName);
  });

  const feeOptions = data.fee_types.filter((f) => f.category === 'ujian' || f.category === 'kegiatan');
  return (
    <>
      <PageHeader title="Kartu Ujian" subtitle="Kartu peserta ber-QR terbit otomatis bila SPP & biaya ujian lunas; pengawas memverifikasi saat ujian" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'peserta', label: 'Status Peserta' }, { value: 'periode', label: `Periode Ujian (${data.exam_periods.length})` }]} />
      {tab === 'peserta' ? (
        period ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Select className="w-80" value={periodId} onChange={(e) => setPeriodId(Number(e.target.value))} options={data.exam_periods.map((p) => ({ value: p.id, label: p.name }))} />
              <Select className="w-44" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={data.classes.filter((c) => !unitId || c.unit_id === unitId).sort(sortClasses).map((c) => ({ value: c.id, label: c.name }))} />
              <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Semua status" options={[{ value: 'layak', label: 'Kartu terbit' }, { value: 'belum', label: 'Belum memenuhi' }]} />
              <SearchInput value={q} onChange={setQ} placeholder="Cari nama / NIS" />
              <Button variant="secondary" className="ml-auto" onClick={bulkPrint}><Printer className="h-4 w-4" /> Cetak Kartu Kelas</Button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Peserta" value={all.length} tone="blue" />
              <StatCard label="Kartu Terbit" value={eligible.length} tone="green" hint={`${all.length ? Math.round((eligible.length / all.length) * 100) : 0}% peserta`} />
              <StatCard label="Belum Memenuhi" value={all.length - eligible.length} tone="red" hint={rupiah(all.reduce((a, r) => a + r.el.requirements.reduce((b, x) => b + x.outstanding, 0), 0))} />
              <StatCard label="Sudah Diverifikasi" value={all.filter((r) => checkedIn.has(r.id)).length} tone="violet" />
            </div>
            <Card>
              <p className="mb-3 text-sm text-slate-600">Syarat: {period.spp_until ? <>SPP lunas s.d. <b>{periodLabel(period.spp_until)}</b></> : 'tanpa syarat SPP'}{period.required_fee_type_ids.length > 0 && <> · biaya: <b>{period.required_fee_type_ids.map((id) => data.fee_types.find((f) => f.id === id)?.name).filter(Boolean).join(', ')}</b></>} · {fmtDate(period.start_date)} – {fmtDate(period.end_date)}</p>
              <DataTable rows={rows} columns={cols} pageSize={15} empty="Tidak ada peserta" />
            </Card>
          </>
        ) : <Card><Empty text="Belum ada periode ujian. Buat di tab Periode Ujian." /></Card>
      ) : (
        <Card title="Periode Ujian" actions={canManage && <Button size="sm" onClick={() => setEditP({ type: 'PTS', start_date: today(), end_date: today(), spp_until: today().slice(0, 7), required_fee_type_ids: [], is_active: true, unit_id: null, notes: '', academic_year_id: data.academic_years.find((y) => y.is_active)?.id })}><Plus className="h-4 w-4" /> Periode Baru</Button>}>
          <div className="divide-y divide-slate-100">
            {data.exam_periods.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{p.name} {p.is_active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</p>
                  <p className="text-xs text-slate-500">{p.type} · {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {p.unit_id ? unitName(p.unit_id) : 'Semua unit'} · SPP s.d. {p.spp_until ? periodLabel(p.spp_until) : '-'} · {p.required_fee_type_ids.length} biaya wajib</p>
                </div>
                {canManage && <Button size="sm" variant="ghost" onClick={() => setEditP(p)}><Pencil className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
          {!data.exam_periods.length && <Empty />}
        </Card>
      )}

      <Modal open={!!editP} onClose={() => setEditP(null)} title={editP?.id ? 'Ubah Periode Ujian' : 'Periode Ujian Baru'} size="lg" footer={<Button onClick={() => run(async () => {
        const p = editP!;
        if (!p.name?.trim()) throw new Error('Nama periode wajib diisi');
        if (!p.start_date || !p.end_date || p.end_date < p.start_date) throw new Error('Tanggal pelaksanaan tidak valid');
        const payload = { ...p, unit_id: p.unit_id ? Number(p.unit_id) : null, notes: p.notes || '', spp_until: p.spp_until || '' };
        if (p.id) await api.update('exam_periods', p.id, payload);
        else await api.create('exam_periods', payload);
        setEditP(null);
      }, 'Periode ujian disimpan')}>Simpan</Button>}>
        {editP && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Periode" required className="sm:col-span-2"><Input value={editP.name || ''} onChange={(e) => setEditP({ ...editP, name: e.target.value })} placeholder="Penilaian Akhir Semester Ganjil 2026/2027" /></Field>
            <Field label="Jenis Ujian"><Select value={editP.type} onChange={(e) => setEditP({ ...editP, type: e.target.value as ExamPeriod['type'] })} options={TYPES.map((t) => ({ value: t, label: t }))} /></Field>
            <Field label="Unit"><Select value={editP.unit_id ?? ''} onChange={(e) => setEditP({ ...editP, unit_id: e.target.value ? Number(e.target.value) : null })} placeholder="Semua unit" options={data.units.map((u) => ({ value: u.id, label: u.name }))} /></Field>
            <Field label="Mulai"><Input type="date" value={editP.start_date} onChange={(e) => setEditP({ ...editP, start_date: e.target.value })} /></Field>
            <Field label="Selesai"><Input type="date" value={editP.end_date} onChange={(e) => setEditP({ ...editP, end_date: e.target.value })} /></Field>
            <Field label="SPP wajib lunas s.d. bulan" hint="Kosongkan bila SPP tidak disyaratkan"><Input type="month" value={editP.spp_until || ''} onChange={(e) => setEditP({ ...editP, spp_until: e.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={!!editP.is_active} onChange={(e) => setEditP({ ...editP, is_active: e.target.checked })} /> Periode aktif</label>
            <Field label="Biaya yang wajib lunas" className="sm:col-span-2">
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {feeOptions.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(editP.required_fee_type_ids || []).includes(f.id)} onChange={(e) => setEditP({ ...editP, required_fee_type_ids: e.target.checked ? [...(editP.required_fee_type_ids || []), f.id] : (editP.required_fee_type_ids || []).filter((x) => x !== f.id) })} />
                    {f.name} <span className="text-xs text-slate-400">{rupiah(f.amount)}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Catatan pada kartu" className="sm:col-span-2"><Textarea value={editP.notes || ''} onChange={(e) => setEditP({ ...editP, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!disp} onClose={() => setDisp(null)} title="Beri Dispensasi Kartu Ujian" size="sm" footer={<Button onClick={() => run(async () => { await api.action('examcard.dispense', { period_id: periodId, student_id: disp!.student.id, reason: disp!.reason }); setDisp(null); }, 'Dispensasi diberikan — kartu ujian terbit')}>Beri Dispensasi</Button>}>
        {disp && period && (
          <div className="space-y-3 text-sm">
            <p><b>{disp.student.name}</b> · {cls.get(disp.student.class_id || 0)?.name}</p>
            <RequirementList items={examEligibility(data, period, disp.student).requirements} />
            <Field label="Alasan / kesepakatan"><Textarea value={disp.reason} onChange={(e) => setDisp({ ...disp, reason: e.target.value })} placeholder="Contoh: orang tua berkomitmen melunasi paling lambat 15 Oktober" /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title="Kartu Ujian" size="lg">
        {view && period && <ExamCardView student={view} period={period} schoolName={data.settings[0].foundation} unitName={unitName(view.unit_id)} />}
      </Modal>
    </>
  );
}
