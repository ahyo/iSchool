'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, GraduationCap, History, TrendingUp } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, DataTable, Loading, Modal, PageHeader, Select, StatusBadge, Tabs, run, type Column } from '@/components/ui';
import { indexBy, sortClasses } from '@/lib/scope';
import { avg, cn, fmtDateTime, gradeLabel, round } from '@/lib/utils';
import type { Promotion } from '@/lib/types';

type Decision = { result: Promotion['result']; to_class_id: number | null; note: string };

export default function KenaikanPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee } = useProfile();
  const { data } = useData(['classes', 'students', 'grades', 'subjects', 'student_attendance', 'student_records', 'units', 'academic_years', 'promotions']);
  const [tab, setTab] = useState<'proses' | 'riwayat'>('proses');
  const [classId, setClassId] = useState(0);
  const [dec, setDec] = useState<Record<number, Decision>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canProcess = ['admin', 'kepsek', 'kesiswaan'].includes(user?.role || '');

  const classes = useMemo(() => {
    if (!data) return [];
    let c = data.classes;
    if (user?.role === 'guru') c = c.filter((x) => x.homeroom_id === employee?.id);
    else if (unitId) c = c.filter((x) => x.unit_id === unitId);
    return [...c].sort(sortClasses);
  }, [data, user, employee, unitId]);
  useEffect(() => {
    if (classes.length && !classes.some((c) => c.id === classId)) setClassId(classes[0].id);
  }, [classes, classId]);

  const cls = data?.classes.find((c) => c.id === classId);
  const unit = data?.units.find((u) => u.id === cls?.unit_id);
  const isFinal = !!cls && !!unit && cls.grade === unit.max_grade;
  const targets = useMemo(() => (data && cls ? data.classes.filter((c) => c.unit_id === cls.unit_id && c.grade === cls.grade + 1).sort(sortClasses) : []), [data, cls]);

  const analysis = useMemo(() => {
    if (!data || !cls) return [];
    const ay = data.academic_years.find((y) => y.is_active)!;
    const subs = indexBy(data.subjects);
    return data.students
      .filter((s) => s.class_id === cls.id && s.status === 'aktif')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => {
        const g = data.grades.filter((x) => x.student_id === s.id && x.academic_year_id === ay.id);
        const below = g.filter((x) => x.final !== null && x.final < (subs.get(x.subject_id)?.kkm || 75)).length;
        const att = data.student_attendance.filter((a) => a.student_id === s.id);
        const attPct = att.length ? (att.filter((a) => a.status === 'H').length / att.length) * 100 : 100;
        const points = data.student_records.filter((r) => r.student_id === s.id && r.type === 'pelanggaran').reduce((a, r) => a + r.points, 0);
        const ok = below <= 3 && attPct >= 85 && points < 75;
        const reasons = [below > 3 && `${below} mapel di bawah KKTP`, attPct < 85 && `kehadiran ${round(attPct, 0)}%`, points >= 75 && `poin pelanggaran ${points}`].filter(Boolean) as string[];
        return { ...s, mean: round(avg(g.map((x) => x.final)), 1), below, attPct: round(attPct, 1), points, ok, reasons };
      });
  }, [data, cls]);

  useEffect(() => {
    const d: Record<number, Decision> = {};
    analysis.forEach((s) => {
      const matchMajor = targets.find((t) => t.major_id && t.major_id === cls?.major_id) || targets[0];
      d[s.id] = isFinal ? { result: s.ok ? 'lulus' : 'tinggal', to_class_id: s.ok ? null : classId, note: s.reasons.join(', ') } : { result: s.ok ? 'naik' : 'tinggal', to_class_id: s.ok ? matchMajor?.id ?? null : classId, note: s.reasons.join(', ') };
    });
    setDec(d);
  }, [analysis, targets, isFinal, classId, cls]);

  if (!data) return <Loading />;
  const clsIdx = indexBy(data.classes);
  const studentsIdx = indexBy(data.students);
  const ay = data.academic_years.find((y) => y.is_active)!;
  type A = (typeof analysis)[number];
  const cols: Column<A>[] = [
    { key: 'name', header: 'Siswa', render: (s) => <div><p className="font-medium">{s.name}</p><p className="font-mono text-xs text-slate-500">{s.nis}</p></div> },
    { key: 'mean', header: 'Rata² Nilai', render: (s) => <b>{s.mean ?? '-'}</b> },
    { key: 'below', header: '< KKTP', render: (s) => <span className={s.below > 3 ? 'font-bold text-red-600' : ''}>{s.below}</span> },
    { key: 'attPct', header: 'Kehadiran', render: (s) => <span className={s.attPct! < 85 ? 'font-bold text-red-600' : ''}>{s.attPct}%</span> },
    { key: 'points', header: 'Poin Pelanggaran' },
    { key: 'rek', header: 'Rekomendasi Sistem', render: (s) => s.ok ? <Badge tone="green">{isFinal ? 'Lulus' : 'Naik'}</Badge> : <span title={s.reasons.join(', ')}><Badge tone="red">{isFinal ? 'Belum lulus' : 'Tinggal'}</Badge></span> },
    {
      key: 'dec', header: 'Keputusan', render: (s) => (
        <div className="flex gap-1">
          <Select disabled={!canProcess} className="w-32 py-1.5" value={dec[s.id]?.result || ''} onChange={(e) => { const r = e.target.value as Decision['result']; setDec({ ...dec, [s.id]: { ...dec[s.id], result: r, to_class_id: r === 'tinggal' ? classId : r === 'lulus' ? null : targets[0]?.id ?? null } }); }}
            options={isFinal ? [{ value: 'lulus', label: 'Lulus' }, { value: 'tinggal', label: 'Tidak lulus' }] : [{ value: 'naik', label: 'Naik kelas' }, { value: 'tinggal', label: 'Tinggal kelas' }]} />
          {dec[s.id]?.result === 'naik' && (
            <Select disabled={!canProcess} className="w-32 py-1.5" value={dec[s.id]?.to_class_id || ''} onChange={(e) => setDec({ ...dec, [s.id]: { ...dec[s.id], to_class_id: Number(e.target.value) } })} options={targets.map((t) => ({ value: t.id, label: t.name }))} />
          )}
        </div>
      ),
    },
  ];

  const summary = { naik: Object.values(dec).filter((d) => d.result === 'naik').length, lulus: Object.values(dec).filter((d) => d.result === 'lulus').length, tinggal: Object.values(dec).filter((d) => d.result === 'tinggal').length };
  const history = [...data.promotions].sort((a, b) => b.processed_at.localeCompare(a.processed_at)).filter((p) => !unitId || studentsIdx.get(p.student_id)?.unit_id === unitId);
  const histCols: Column<Promotion>[] = [
    { key: 'student', header: 'Siswa', render: (p) => studentsIdx.get(p.student_id)?.name },
    { key: 'from', header: 'Dari', render: (p) => clsIdx.get(p.from_class_id || 0)?.name || '-' },
    { key: 'to', header: 'Ke', render: (p) => (p.result === 'lulus' ? 'Alumni' : clsIdx.get(p.to_class_id || 0)?.name || '-') },
    { key: 'result', header: 'Hasil', render: (p) => <StatusBadge status={p.result} /> },
    { key: 'note', header: 'Catatan', render: (p) => <span className="text-xs">{p.note || '-'}</span> },
    { key: 'processed_at', header: 'Diproses', render: (p) => fmtDateTime(p.processed_at) },
  ];

  return (
    <>
      <PageHeader title="Kenaikan Kelas & Kelulusan" subtitle={`Rekomendasi otomatis berdasarkan nilai, kehadiran, dan kedisiplinan · TA ${ay.name}`} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'proses', label: 'Proses Kenaikan/Kelulusan' }, { value: 'riwayat', label: `Riwayat (${history.length})` }]} />
      {tab === 'proses' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select className="w-52" value={classId} onChange={(e) => setClassId(Number(e.target.value))} options={classes.map((c) => ({ value: c.id, label: `${c.name} (${data.units.find((u) => u.id === c.unit_id)?.code})` }))} />
            {cls && <Badge tone={isFinal ? 'violet' : 'blue'}>{isFinal ? `Kelas akhir ${unit?.code} — proses kelulusan` : `Kelas ${gradeLabel(cls.grade)} → ${gradeLabel(cls.grade + 1)}`}</Badge>}
          </div>
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-500" /> Kriteria: maksimal 3 mapel di bawah KKTP, kehadiran ≥ 85%, dan poin pelanggaran &lt; 75. Keputusan akhir ditetapkan melalui rapat dewan guru.
          </div>
          <Card
            title={<span className="flex items-center gap-2">{isFinal ? <GraduationCap className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />} {cls?.name} · {analysis.length} siswa</span>}
            actions={<>
              <span className="text-sm text-slate-500">{isFinal ? `${summary.lulus} lulus` : `${summary.naik} naik`} · {summary.tinggal} {isFinal ? 'tidak lulus' : 'tinggal'}</span>
              {canProcess && <Button size="sm" disabled={!analysis.length} onClick={() => setConfirmOpen(true)}>Tetapkan Keputusan</Button>}
            </>}
          >
            <DataTable rows={analysis} columns={cols} pageSize={40} empty="Tidak ada siswa aktif di kelas ini" />
          </Card>
        </>
      ) : (
        <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4" /> Riwayat Kenaikan & Kelulusan</span>}><DataTable rows={history} columns={histCols} /></Card>
      )}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Konfirmasi Keputusan" size="sm" footer={<>
        <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Batal</Button>
        <Button onClick={() => run(async () => { await api.action('promotions.process', { academic_year_id: ay.id, decisions: Object.entries(dec).map(([id, d]) => ({ student_id: Number(id), ...d })) }); setConfirmOpen(false); }, 'Keputusan kenaikan/kelulusan diproses')}>Proses</Button>
      </>}>
        <p className={cn('text-sm')}>Proses keputusan untuk <b>{analysis.length}</b> siswa kelas <b>{cls?.name}</b>? Siswa {isFinal ? 'yang lulus akan berstatus alumni' : 'yang naik akan dipindahkan ke kelas tujuan'}. Tindakan ini tercatat di riwayat.</p>
      </Modal>
    </>
  );
}
