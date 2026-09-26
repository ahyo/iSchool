'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileQuestion, MonitorPlay, Plus, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useLearningScope, type LearningScope } from '@/lib/useLearningScope';
import { Avatar, Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Tabs, run, toast } from '@/components/ui';
import { cn, avg, fmtDate, round, today } from '@/lib/utils';
import type { Exam, Question } from '@/lib/types';

const TYPE_LABEL: Record<Exam['type'], string> = { UH: 'Ulangan Harian', PTS: 'Penilaian Tengah Semester', PAS: 'Penilaian Akhir Semester', PAT: 'Penilaian Akhir Tahun', US: 'Ujian Sekolah', UKK: 'Uji Kompetensi Keahlian' };

export default function UjianPage() {
  const scope = useLearningScope();
  if (!scope) return <Loading />;
  return scope.student ? <StudentExams scope={scope} /> : <TeacherExams scope={scope} />;
}

/* ============================ SISWA / ORTU ============================ */
function StudentExams({ scope }: { scope: LearningScope }) {
  const { data } = useData(['exams', 'exam_results', 'bills', 'fee_types']);
  const [taking, setTaking] = useState<Exam | null>(null);
  if (!data) return <Loading />;
  const st = scope.student!;
  const readOnly = scope.role === 'ortu';
  const exams = data.exams.filter((e) => e.class_id === st.class_id).sort((a, b) => a.date.localeCompare(b.date));
  const result = (e: Exam) => data.exam_results.find((r) => r.exam_id === e.id && r.student_id === st.id);
  const upcoming = exams.filter((e) => !result(e) && e.date >= today());
  const done = exams.filter((e) => result(e) || e.date < today()).reverse();
  const examFees = data.fee_types.filter((f) => f.category === 'ujian').map((f) => f.id);
  const unpaidExamFee = data.bills.some((b) => b.student_id === st.id && examFees.includes(b.fee_type_id) && b.status !== 'lunas');

  return (
    <>
      <PageHeader title="Ujian & CBT" subtitle={`${st.name} · ${exams.length} ujian terjadwal semester ini`} />
      {unpaidExamFee && <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" /> Terdapat biaya ujian yang belum lunas. Kartu ujian PTS/PAS akan diterbitkan setelah pelunasan.</div>}
      <h3 className="mb-2 font-semibold">Ujian Mendatang & Hari Ini</h3>
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {upcoming.map((e) => {
          const openNow = e.date === today() && e.is_online;
          return (
            <Card key={e.id}>
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2.5', openNow ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600')}><FileQuestion className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold">{e.name}</p>
                  <p className="text-sm text-slate-500">{scope.subjects.get(e.subject_id)?.name} · {TYPE_LABEL[e.type]}</p>
                  <p className="mt-1 text-sm">{fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {e.start_time} · {e.duration} menit · {e.questions.length} soal</p>
                </div>
                {!readOnly && (openNow ? <Button onClick={() => setTaking(e)}><MonitorPlay className="h-4 w-4" /> Mulai</Button> : <Badge tone="violet">Belum dibuka</Badge>)}
              </div>
            </Card>
          );
        })}
        {!upcoming.length && <Card className="md:col-span-2"><Empty text="Tidak ada ujian mendatang" /></Card>}
      </div>
      <h3 className="mb-2 font-semibold">Hasil Ujian</h3>
      <Card bodyClass="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Ujian</th><th>Mapel</th><th>Tanggal</th><th className="text-right pr-4">Nilai</th></tr></thead>
          <tbody>
            {done.map((e) => {
              const r = result(e);
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td>{scope.subjects.get(e.subject_id)?.name}</td>
                  <td>{fmtDate(e.date)}</td>
                  <td className="pr-4 text-right">{r ? <span className={cn('text-lg font-bold', r.score >= (scope.subjects.get(e.subject_id)?.kkm || 75) ? 'text-emerald-600' : 'text-red-600')}>{r.score}</span> : <Badge tone="red">Tidak ikut</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!done.length && <Empty />}
      </Card>
      {taking && <CBT exam={taking} studentId={st.id} onClose={() => setTaking(null)} />}
    </>
  );
}

function CBT({ exam, studentId, onClose }: { exam: Exam; studentId: number; onClose: () => void }) {
  const [answers, setAnswers] = useState<number[]>(() => exam.questions.map(() => -1));
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(exam.duration * 60);
  const [result, setResult] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || result !== null) return;
    setBusy(true);
    try {
      const r = await api.action<{ score: number; correct: number }>('exams.submit', { exam_id: exam.id, student_id: studentId, answers });
      setCorrect(r.correct);
      setResult(r.score);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (result !== null) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [result]);
  useEffect(() => {
    if (left <= 0 && result === null) submit();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = exam.questions[idx];
  const answered = answers.filter((a) => a >= 0).length;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      <div className="flex items-center gap-4 bg-slate-900 px-6 py-3 text-white">
        <MonitorPlay className="h-5 w-5" />
        <p className="flex-1 font-semibold">{exam.name}</p>
        {result === null && <span className={cn('flex items-center gap-1 rounded-lg px-3 py-1 font-mono text-lg', left < 60 ? 'bg-red-600' : 'bg-white/10')}><Clock className="h-4 w-4" /> {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>}
      </div>
      {result !== null ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="mt-3 text-lg font-semibold">Jawaban terkirim</p>
            <p className="mt-2 text-5xl font-extrabold text-brand-700">{result}</p>
            <p className="mt-1 text-sm text-slate-500">{correct} dari {exam.questions.length} jawaban benar</p>
            <Button className="mt-6 w-full" onClick={onClose}>Tutup</Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Soal {idx + 1} dari {exam.questions.length}</p>
            <p className="mt-3 text-lg font-medium">{q.q}</p>
            <div className="mt-5 space-y-2">
              {q.options.map((o, i) => (
                <button key={i} onClick={() => setAnswers((a) => a.map((x, j) => (j === idx ? i : x)))} className={cn('flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition', answers[idx] === i ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold', answers[idx] === i ? 'bg-brand-600 text-white' : 'bg-slate-100')}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Sebelumnya</Button>
              {idx < exam.questions.length - 1 ? <Button onClick={() => setIdx(idx + 1)}>Berikutnya</Button> : <Button variant="success" loading={busy} onClick={() => confirm(`Kirim jawaban? ${exam.questions.length - answered} soal belum dijawab.`) && submit()}>Selesai & Kirim</Button>}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Navigasi Soal <span className="font-normal text-slate-500">({answered}/{exam.questions.length})</span></p>
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={cn('h-10 rounded-lg text-sm font-semibold', i === idx && 'ring-2 ring-brand-500', answers[i] >= 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600')}>{i + 1}</button>
              ))}
            </div>
            <Button variant="success" className="mt-4 w-full" loading={busy} onClick={() => confirm('Kirim jawaban sekarang?') && submit()}>Kirim Jawaban</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ GURU / STAF ============================ */
function TeacherExams({ scope }: { scope: LearningScope }) {
  const { data } = useData(['exams', 'exam_results', 'grades', 'academic_years']);
  const [classId, setClassId] = useState('');
  const [tab, setTab] = useState<'mendatang' | 'selesai'>('mendatang');
  const [builder, setBuilder] = useState<Partial<Exam> | null>(null);
  const [results, setResults] = useState<Exam | null>(null);
  const rows = useMemo(() => (data?.exams || []).filter((e) => scope.pairAllowed(e.class_id, e.subject_id) && (!classId || e.class_id === Number(classId))), [data, scope, classId]);
  if (!data) return <Loading />;
  const { classList, subjects, classes, pairs, canManage } = scope;
  const list = rows.filter((e) => (tab === 'mendatang' ? e.date >= today() : e.date < today())).sort((a, b) => (tab === 'mendatang' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const resOf = (e: Exam) => data.exam_results.filter((r) => r.exam_id === e.id);
  const ay = data.academic_years.find((y) => y.is_active)!;

  const syncGrades = (e: Exam) => run(async () => {
    const field = e.type === 'PTS' ? 'midterm' : e.type === 'PAS' || e.type === 'PAT' ? 'final_exam' : 'daily';
    const sameType = data.exams.filter((x) => x.class_id === e.class_id && x.subject_id === e.subject_id && (field === 'daily' ? x.type === 'UH' : x.type === e.type)).map((x) => x.id);
    const studs = scope.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif');
    const payload = studs.map((s) => {
      const g = data.grades.find((x) => x.student_id === s.id && x.subject_id === e.subject_id && x.academic_year_id === ay.id);
      const scores = data.exam_results.filter((r) => sameType.includes(r.exam_id) && r.student_id === s.id).map((r) => r.score);
      return { student_id: s.id, subject_id: e.subject_id, academic_year_id: ay.id, assignment: g?.assignment ?? null, daily: g?.daily ?? null, midterm: g?.midterm ?? null, final_exam: g?.final_exam ?? null, [field]: round(avg(scores), 0) ?? g?.[field as 'daily'] ?? null };
    });
    await api.action('grades.save', { rows: payload });
  }, 'Nilai ujian dikirim ke buku nilai');

  return (
    <>
      <PageHeader title="Ujian & CBT" subtitle="Jadwal ujian, bank soal, dan penilaian otomatis" actions={canManage && <Button onClick={() => setBuilder({ class_id: Number(classId) || pairs[0]?.class_id, subject_id: pairs[0]?.subject_id, type: 'UH', date: today(), start_time: '08:00', duration: 45, is_online: true, questions: [{ q: '', options: ['', '', '', ''], answer: 0 }] })}><Plus className="h-4 w-4" /> Buat Ujian</Button>} />
      <div className="mb-4"><Select className="w-52" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={classList.map((c) => ({ value: c.id, label: c.name }))} /></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'mendatang', label: 'Mendatang / Hari Ini' }, { value: 'selesai', label: 'Selesai' }]} />
      <Card bodyClass="p-0">
        <div className="divide-y divide-slate-100">
          {list.map((e) => {
            const r = resOf(e);
            const total = scope.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif').length;
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="font-medium">{e.name} <Badge tone="violet" className="ml-1">{e.type}</Badge></p>
                  <p className="text-xs text-slate-500">{subjects.get(e.subject_id)?.name} · {classes.get(e.class_id)?.name} · {fmtDate(e.date)} {e.start_time} · {e.duration} mnt · {e.questions.length} soal {e.is_online ? '· CBT' : ''}</p>
                </div>
                <div className="text-center text-sm"><p className="font-bold">{r.length}/{total}</p><p className="text-xs text-slate-500">peserta</p></div>
                <div className="text-center text-sm"><p className="font-bold">{round(avg(r.map((x) => x.score)), 1) ?? '-'}</p><p className="text-xs text-slate-500">rata-rata</p></div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setResults(e)}><BarChart3 className="h-4 w-4" /> Hasil</Button>
                  {canManage && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus ujian?') && run(() => api.remove('exams', e.id), 'Ujian dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              </div>
            );
          })}
        </div>
        {!list.length && <Empty text="Tidak ada ujian" />}
      </Card>

      {builder && <ExamBuilder initial={builder} scope={scope} onClose={() => setBuilder(null)} />}

      <Modal open={!!results} onClose={() => setResults(null)} title={`Hasil: ${results?.name}`} size="lg" footer={canManage && results && <Button onClick={() => syncGrades(results)}>Kirim ke Buku Nilai ({results.type === 'PTS' ? 'PTS' : results.type === 'PAS' || results.type === 'PAT' ? 'PAS' : 'Harian'})</Button>}>
        {results && (() => {
          const r = resOf(results);
          const kkm = subjects.get(results.subject_id)?.kkm || 75;
          const studs = scope.students.filter((s) => s.class_id === results.class_id && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name));
          return (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Rata-rata" value={round(avg(r.map((x) => x.score)), 1) ?? '-'} />
                <StatCard label="Tertinggi" value={r.length ? Math.max(...r.map((x) => x.score)) : '-'} />
                <StatCard label="Terendah" value={r.length ? Math.min(...r.map((x) => x.score)) : '-'} />
                <StatCard label={`Tuntas (≥${kkm})`} value={`${r.filter((x) => x.score >= kkm).length}/${studs.length}`} />
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {studs.map((s) => {
                    const x = r.find((y) => y.student_id === s.id);
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-2"><span className="flex items-center gap-2"><Avatar name={s.name} className="h-7 w-7 text-[10px]" />{s.name}</span></td>
                        <td className="text-right">{x ? <span className={cn('font-bold', x.score >= kkm ? 'text-emerald-600' : 'text-red-600')}>{x.score}</span> : <Badge>Belum mengerjakan</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          );
        })()}
      </Modal>
    </>
  );
}

function ExamBuilder({ initial, scope, onClose }: { initial: Partial<Exam>; scope: LearningScope; onClose: () => void }) {
  const [e, setE] = useState<Partial<Exam>>(initial);
  const qs = e.questions || [];
  const setQ = (i: number, q: Partial<Question>) => setE({ ...e, questions: qs.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const save = () => run(async () => {
    if (!e.name) throw new Error('Nama ujian wajib diisi');
    if (e.is_online && qs.some((q) => !q.q || q.options.some((o) => !o))) throw new Error('Lengkapi semua soal dan pilihan jawaban');
    const teacher_id = scope.employee?.id || (await api.list('schedules', { class_id: e.class_id, subject_id: e.subject_id }))[0]?.teacher_id || 0;
    await api.create('exams', { ...e, class_id: Number(e.class_id), subject_id: Number(e.subject_id), duration: Number(e.duration), teacher_id, questions: e.is_online ? qs : [] } as Exam);
    onClose();
  }, 'Ujian dibuat');
  return (
    <Modal open onClose={onClose} title="Buat Ujian" size="xl" footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save}>Simpan Ujian</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nama Ujian" className="sm:col-span-2" required><Input value={e.name || ''} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        <Field label="Jenis"><Select value={e.type} onChange={(x) => setE({ ...e, type: x.target.value as Exam['type'] })} options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label="Kelas"><Select value={e.class_id} onChange={(x) => setE({ ...e, class_id: Number(x.target.value) })} options={scope.classList.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="Mata Pelajaran"><Select value={e.subject_id} onChange={(x) => setE({ ...e, subject_id: Number(x.target.value) })} options={[...new Set(scope.pairs.filter((p) => p.class_id === Number(e.class_id)).map((p) => p.subject_id))].map((id) => ({ value: id, label: scope.subjects.get(id)?.name || '' }))} /></Field>
        <Field label="Tanggal"><Input type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} /></Field>
        <Field label="Jam Mulai"><Input type="time" value={e.start_time} onChange={(x) => setE({ ...e, start_time: x.target.value })} /></Field>
        <Field label="Durasi (menit)"><Input type="number" value={e.duration} onChange={(x) => setE({ ...e, duration: Number(x.target.value) })} /></Field>
        <Field label="Mode"><Select value={e.is_online ? '1' : '0'} onChange={(x) => setE({ ...e, is_online: x.target.value === '1' })} options={[{ value: '1', label: 'CBT Online (pilihan ganda)' }, { value: '0', label: 'Tertulis / luring' }]} /></Field>
      </div>
      {e.is_online && (
        <div className="mt-6 space-y-4">
          <p className="font-semibold">Soal Pilihan Ganda ({qs.length})</p>
          {qs.map((q, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">{i + 1}.</span>
                <Input value={q.q} placeholder="Pertanyaan" onChange={(x) => setQ(i, { q: x.target.value })} />
                <Button size="sm" variant="ghost" onClick={() => setE({ ...e, questions: qs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} title="Kunci jawaban" />
                    <span className="text-sm font-semibold">{String.fromCharCode(65 + k)}</span>
                    <Input value={o} onChange={(x) => setQ(i, { options: q.options.map((y, m) => (m === k ? x.target.value : y)) })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setE({ ...e, questions: [...qs, { q: '', options: ['', '', '', ''], answer: 0 }] })}><Plus className="h-4 w-4" /> Tambah Soal</Button>
          <p className="text-xs text-slate-500">Pilih tombol radio untuk menandai kunci jawaban. Nilai dihitung otomatis saat siswa mengirim jawaban.</p>
        </div>
      )}
    </Modal>
  );
}
