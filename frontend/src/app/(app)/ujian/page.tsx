'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, CalendarPlus, CheckCircle2, Clock, FileQuestion, MonitorPlay, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useLearningScope, type LearningScope } from '@/lib/useLearningScope';
import { Avatar, Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Tabs, run, toast } from '@/components/ui';
import { cn, avg, fmtDate, fmtDateTime, round, today } from '@/lib/utils';
import type { AnswerValue, Exam, ExamAttempt, ExamResult, ExamWindow, Question } from '@/lib/types';
import { QuestionInput } from '@/components/QuestionInput';
import { emptyAnswer, isAnswered, qPoints, qType } from '@/lib/scoring';
import { QuestionEditor, emptyQuestion, validateQuestions } from '@/components/QuestionEditor';
import { examEligibility, periodForExam } from '@/lib/examcard';
import { addMinutes, availability, effectiveScore, examEnd, KIND_LABEL, type Availability } from '@/lib/cbt';

const TYPE_LABEL: Record<Exam['type'], string> = { UH: 'Ulangan Harian', PTS: 'Penilaian Tengah Semester', PAS: 'Penilaian Akhir Semester', PAT: 'Penilaian Akhir Tahun', US: 'Ujian Sekolah', UKK: 'Uji Kompetensi Keahlian' };

export default function UjianPage() {
  const scope = useLearningScope();
  if (!scope) return <Loading />;
  return scope.student ? <StudentExams scope={scope} /> : <TeacherExams scope={scope} />;
}

/** Jam sekarang yang diperbarui tiap 30 detik (untuk status buka/tutup). */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ============================ SISWA / ORTU ============================ */
function StudentExams({ scope }: { scope: LearningScope }) {
  const { data } = useData(['exams', 'exam_results', 'exam_windows', 'exam_attempts', 'bills', 'fee_types', 'exam_periods', 'exam_dispensations']);
  const [taking, setTaking] = useState<Exam | null>(null);
  const now = useNow();
  if (!data) return <Loading />;
  const st = scope.student!;
  const readOnly = scope.role === 'ortu';
  const kkm = (e: Exam) => scope.subjects.get(e.subject_id)?.kkm || 75;
  const exams = data.exams.filter((e) => e.class_id === st.class_id).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const av = new Map(exams.map((e) => [e.id, availability(e, data.exam_windows, data.exam_results, data.exam_attempts, st.id, kkm(e), now)]));
  const results = (e: Exam) => data.exam_results.filter((r) => r.exam_id === e.id && r.student_id === st.id);
  const active = exams.filter((e) => ['open', 'resume', 'upcoming'].includes(av.get(e.id)!.state));
  const done = exams.filter((e) => !active.includes(e)).reverse();
  const examFees = data.fee_types.filter((f) => f.category === 'ujian').map((f) => f.id);
  const unpaidExamFee = data.bills.some((b) => b.student_id === st.id && examFees.includes(b.fee_type_id) && b.status !== 'lunas');
  const cardOk = (e: Exam, date: string) => { const p = periodForExam(data.exam_periods, e.type, date, st.unit_id); return !p || examEligibility(data, p, st).eligible; };

  const action = (e: Exam, a: Availability) => {
    if (a.state === 'resume') return <Button onClick={() => setTaking(e)}><RotateCcw className="h-4 w-4" /> Lanjutkan</Button>;
    if (a.state === 'open') {
      if (!e.is_online) return <Badge tone="blue">Ujian luring · {a.session.start_time}–{a.session.end_time}</Badge>;
      if (!cardOk(e, a.session.date)) return <Link href="/kartu-ujian/"><Badge tone="red">Kartu ujian belum terbit</Badge></Link>;
      return <Button onClick={() => setTaking(e)}><MonitorPlay className="h-4 w-4" /> {a.session.kind === 'utama' ? 'Mulai' : `Mulai ${KIND_LABEL[a.session.kind]}`}</Button>;
    }
    if (a.state === 'upcoming') return <Badge tone="violet">Dibuka {fmtDate(a.session.date, { day: 'numeric', month: 'short' })} {a.session.start_time}</Badge>;
    return null;
  };

  return (
    <>
      <PageHeader title="Ujian & CBT" subtitle={`${st.name} · ${exams.length} ujian semester ini`} />
      {unpaidExamFee && <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" /> Terdapat biaya ujian yang belum lunas. Kartu ujian PTS/PAS akan diterbitkan setelah pelunasan. <Link href="/kartu-ujian/" className="font-semibold underline">Lihat kartu ujian</Link></div>}
      <h3 className="mb-2 font-semibold">Ujian Berlangsung & Mendatang</h3>
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {active.map((e) => {
          const a = av.get(e.id)!;
          const session = 'session' in a ? a.session : null;
          const live = a.state === 'open' || a.state === 'resume';
          return (
            <Card key={e.id}>
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2.5', live ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600')}><FileQuestion className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.name} {session && session.kind !== 'utama' && <Badge tone={session.kind === 'remedial' ? 'amber' : 'blue'} className="ml-1">{KIND_LABEL[session.kind]}</Badge>}</p>
                  <p className="text-sm text-slate-500">{scope.subjects.get(e.subject_id)?.name} · {TYPE_LABEL[e.type]}</p>
                  {session && <p className="mt-1 text-sm">{fmtDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {session.start_time}–{session.end_time} · {e.duration} menit · {e.questions.length} soal</p>}
                  {a.state === 'resume' && <p className="mt-1 text-sm font-medium text-amber-700">Sedang dikerjakan · selesai paling lambat {fmtDateTime(a.attempt.deadline).split(', ').pop()}</p>}
                </div>
                {!readOnly && action(e, a)}
              </div>
            </Card>
          );
        })}
        {!active.length && <Card className="md:col-span-2"><Empty text="Tidak ada ujian yang berlangsung atau terjadwal" /></Card>}
      </div>
      <h3 className="mb-2 font-semibold">Hasil & Riwayat Ujian</h3>
      <Card bodyClass="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Ujian</th><th>Mapel</th><th>Tanggal</th><th>Keterangan</th><th className="pr-4 text-right">Nilai</th></tr></thead>
          <tbody>
            {done.map((e) => {
              const rs = results(e);
              const eff = effectiveScore(rs, kkm(e));
              const a = av.get(e.id)!;
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td>{scope.subjects.get(e.subject_id)?.name}</td>
                  <td>{fmtDate(e.date)}</td>
                  <td className="text-xs text-slate-500">{rs.map((r) => `${KIND_LABEL[r.kind || 'utama']}: ${r.score}${r.pending_essay ? ' (menunggu koreksi esai)' : ''}`).join(' · ') || (a.state === 'closed' ? a.reason : '-')}</td>
                  <td className="pr-4 text-right">{rs.some((r) => r.pending_essay) ? <Badge tone="amber">Menunggu koreksi</Badge> : eff !== null ? <span className={cn('text-lg font-bold', eff >= kkm(e) ? 'text-emerald-600' : 'text-red-600')}>{eff}</span> : <Badge tone="red">Tidak ikut</Badge>}</td>
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
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; pending_essay?: boolean } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [busy, setBusy] = useState(false);
  const offset = useRef(0); // selisih jam server - jam perangkat
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mulai sesi baru atau lanjutkan sesi yang sedang berjalan (sisa waktu dari server)
  useEffect(() => {
    api.action<{ attempt: ExamAttempt; questions: Question[]; server_now: string }>('exams.start', { exam_id: exam.id, student_id: studentId })
      .then((r) => {
        offset.current = new Date(r.server_now).getTime() - Date.now();
        setAttempt(r.attempt);
        setQuestions(r.questions);
        setAnswers(r.attempt.answers?.length ? r.attempt.answers : r.questions.map(emptyAnswer));
      })
      .catch((e) => setError(e.message));
  }, [exam.id, studentId]);

  const submit = async (auto = false) => {
    if (!attempt || busy || result) return;
    setBusy(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const r = await api.action<{ score: number; correct: number; total: number; pending_essay?: boolean }>('exams.submit', { attempt_id: attempt.id, answers });
      setResult(r);
      if (auto) toast.success('Waktu habis — jawaban dikumpulkan otomatis');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!attempt || result) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(attempt.deadline).getTime() - (Date.now() + offset.current)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt, result]);
  useEffect(() => {
    if (attempt && !result && left === 0 && questions.length) submit(true);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (v: AnswerValue) => {
    const next = answers.map((x, j) => (j === idx ? v : x));
    setAnswers(next);
    setSaved('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.action('exams.saveAnswers', { attempt_id: attempt!.id, answers: next }).then(() => setSaved('saved')).catch(() => setSaved('idle'));
    }, typeof v === 'string' ? 900 : 500);
  };

  const q = questions[idx];
  const answered = questions.filter((qq, i) => isAnswered(qq, answers[i])).length;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      <div className="flex items-center gap-4 bg-slate-900 px-6 py-3 text-white">
        <MonitorPlay className="h-5 w-5" />
        <p className="flex-1 font-semibold">{exam.name} {attempt && attempt.kind !== 'utama' && <span className="ml-2 rounded bg-white/15 px-2 py-0.5 text-xs">{KIND_LABEL[attempt.kind]}</span>}</p>
        {attempt && !result && (
          <>
            <span className="hidden items-center gap-1 text-xs text-slate-300 sm:flex">{saved === 'saving' ? 'Menyimpan…' : saved === 'saved' ? <><Save className="h-3.5 w-3.5" /> Jawaban tersimpan</> : 'Jawaban tersimpan otomatis'}</span>
            <span className={cn('flex items-center gap-1 rounded-lg px-3 py-1 font-mono text-lg', left < 60 ? 'bg-red-600' : 'bg-white/10')} title="Sisa waktu"><Clock className="h-4 w-4" /> {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>
          </>
        )}
        {!result && <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-white/10" title="Keluar sementara — waktu tetap berjalan">Keluar</button>}
      </div>
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><AlertTriangle className="mx-auto h-12 w-12 text-amber-500" /><p className="mt-3 font-semibold">{error}</p><Button className="mt-6" onClick={onClose}>Kembali</Button></div></div>
      ) : result ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="mt-3 text-lg font-semibold">Jawaban terkirim</p>
            <p className="mt-2 text-5xl font-extrabold text-brand-700">{result.score}</p>
            {result.pending_essay
              ? <p className="mt-1 text-sm text-amber-700">Nilai sementara (soal objektif). Nilai akhir keluar setelah guru mengoreksi jawaban esai.</p>
              : <p className="mt-1 text-sm text-slate-500">{result.correct} soal objektif benar dari {result.total} soal</p>}
            {attempt?.kind === 'remedial' && <p className="mt-2 text-xs text-slate-500">Nilai remedial dihitung maksimal setara KKTP.</p>}
            <Button className="mt-6 w-full" onClick={onClose}>Tutup</Button>
          </div>
        </div>
      ) : !q ? <Loading /> : (
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Soal {idx + 1} dari {questions.length}</p>
            <p className="mt-3 whitespace-pre-line text-lg font-medium">{q.q}</p>
            <div className="mt-5"><QuestionInput q={q} value={answers[idx]} onChange={choose} /></div>
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Sebelumnya</Button>
              {idx < questions.length - 1 ? <Button onClick={() => setIdx(idx + 1)}>Berikutnya</Button> : <Button variant="success" loading={busy} onClick={() => confirm(`Kirim jawaban? ${questions.length - answered} soal belum dijawab.`) && submit()}>Selesai & Kirim</Button>}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Navigasi Soal <span className="font-normal text-slate-500">({answered}/{questions.length})</span></p>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={cn('h-10 rounded-lg text-sm font-semibold', i === idx && 'ring-2 ring-brand-500', isAnswered(questions[i], answers[i]) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600')}>{i + 1}</button>
              ))}
            </div>
            <Button variant="success" className="mt-4 w-full" loading={busy} onClick={() => confirm('Kirim jawaban sekarang?') && submit()}>Kirim Jawaban</Button>
            <p className="mt-3 text-xs text-slate-500">Jawaban tersimpan otomatis. Jika keluar atau koneksi terputus, buka kembali ujian ini untuk melanjutkan — waktu tetap berjalan sesuai jadwal.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ GURU / STAF ============================ */
function TeacherExams({ scope }: { scope: LearningScope }) {
  const { data } = useData(['exams', 'exam_results', 'exam_windows', 'exam_attempts', 'grades', 'academic_years']);
  const [classId, setClassId] = useState('');
  const [tab, setTab] = useState<'mendatang' | 'selesai'>('mendatang');
  const [builder, setBuilder] = useState<Partial<Exam> | null>(null);
  const [resultsOf, setResultsOf] = useState<Exam | null>(null);
  const [grading, setGrading] = useState<{ exam: Exam; result: ExamResult; points: Record<number, string> } | null>(null);
  const [win, setWin] = useState<{ exam: Exam; kind: 'susulan' | 'remedial'; date: string; start_time: string; end_time: string; student_ids: number[]; notes: string } | null>(null);
  const rows = useMemo(() => (data?.exams || []).filter((e) => scope.pairAllowed(e.class_id, e.subject_id) && (!classId || e.class_id === Number(classId))), [data, scope, classId]);
  if (!data) return <Loading />;
  const { classList, subjects, classes, pairs, canManage } = scope;
  const hasPending = (e: Exam) => data.exam_windows.some((w) => w.exam_id === e.id && w.date >= today());
  const list = rows.filter((e) => (tab === 'mendatang' ? e.date >= today() || hasPending(e) : e.date < today())).sort((a, b) => (tab === 'mendatang' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const resOf = (e: Exam) => data.exam_results.filter((r) => r.exam_id === e.id);
  const members = (e: Exam) => scope.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name));
  const kkmOf = (e: Exam) => subjects.get(e.subject_id)?.kkm || 75;
  const eff = (e: Exam, sid: number) => effectiveScore(resOf(e).filter((r) => r.student_id === sid), kkmOf(e));
  const ay = data.academic_years.find((y) => y.is_active)!;

  const syncGrades = (e: Exam) => run(async () => {
    const field = e.type === 'PTS' ? 'midterm' : e.type === 'PAS' || e.type === 'PAT' ? 'final_exam' : 'daily';
    const sameType = data.exams.filter((x) => x.class_id === e.class_id && x.subject_id === e.subject_id && (field === 'daily' ? x.type === 'UH' : x.type === e.type));
    const payload = members(e).map((s) => {
      const g = data.grades.find((x) => x.student_id === s.id && x.subject_id === e.subject_id && x.academic_year_id === ay.id);
      const scores = sameType.map((x) => eff(x, s.id)).filter((v): v is number => v !== null);
      return { student_id: s.id, subject_id: e.subject_id, academic_year_id: ay.id, assignment: g?.assignment ?? null, daily: g?.daily ?? null, midterm: g?.midterm ?? null, final_exam: g?.final_exam ?? null, [field]: round(avg(scores), 0) ?? g?.[field as 'daily'] ?? null };
    });
    await api.action('grades.save', { rows: payload });
  }, 'Nilai ujian (termasuk susulan/remedial) dikirim ke buku nilai');

  const openWindow = (e: Exam, kind: 'susulan' | 'remedial') => {
    const ids = members(e).filter((s) => {
      const rs = resOf(e).filter((r) => r.student_id === s.id);
      return kind === 'susulan' ? !rs.some((r) => r.kind !== 'remedial') : rs.some((r) => r.kind !== 'remedial') && !rs.some((r) => r.kind === 'remedial') && (eff(e, s.id) ?? 0) < kkmOf(e);
    }).map((s) => s.id);
    if (!ids.length) return toast.error(kind === 'susulan' ? 'Semua siswa sudah mengikuti ujian' : 'Tidak ada siswa yang memerlukan remedial');
    setWin({ exam: e, kind, date: today(), start_time: '13:00', end_time: addMinutes('13:00', e.duration + 30), student_ids: ids, notes: '' });
  };

  return (
    <>
      <PageHeader title="Ujian & CBT" subtitle="Jadwal buka–tutup ujian, bank soal, penilaian otomatis, ujian susulan & remedial" actions={canManage && <Button onClick={() => setBuilder({ class_id: Number(classId) || pairs[0]?.class_id, subject_id: pairs[0]?.subject_id, type: 'UH', date: today(), start_time: '08:00', end_time: '09:30', duration: 45, is_online: true, questions: [emptyQuestion('pg')] })}><Plus className="h-4 w-4" /> Buat Ujian</Button>} />
      <div className="mb-4"><Select className="w-52" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={classList.map((c) => ({ value: c.id, label: c.name }))} /></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'mendatang', label: 'Mendatang / Berlangsung' }, { value: 'selesai', label: 'Selesai' }]} />
      <Card bodyClass="p-0">
        <div className="divide-y divide-slate-100">
          {list.map((e) => {
            const r = resOf(e);
            const total = members(e).length;
            const main = new Set(r.filter((x) => x.kind !== 'remedial').map((x) => x.student_id));
            const inProgress = data.exam_attempts.filter((a) => a.exam_id === e.id && !a.submitted_at).length;
            const wins = data.exam_windows.filter((w) => w.exam_id === e.id);
            return (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[220px] flex-1">
                    <p className="font-medium">{e.name} <Badge tone="violet" className="ml-1">{e.type}</Badge></p>
                    <p className="text-xs text-slate-500">{subjects.get(e.subject_id)?.name} · {classes.get(e.class_id)?.name} · {fmtDate(e.date)} {e.start_time}–{examEnd(e)} · {e.duration} mnt · {e.questions.length} soal {e.is_online ? '· CBT' : ''}</p>
                  </div>
                  <div className="text-center text-sm"><p className="font-bold">{main.size}/{total}</p><p className="text-xs text-slate-500">peserta</p></div>
                  {inProgress > 0 && <Badge tone="green">{inProgress} sedang mengerjakan</Badge>}
                  {r.some((x) => x.pending_essay) && <Badge tone="amber">{r.filter((x) => x.pending_essay).length} esai perlu dikoreksi</Badge>}
                  <div className="text-center text-sm"><p className="font-bold">{round(avg(members(e).map((s) => eff(e, s.id))), 1) ?? '-'}</p><p className="text-xs text-slate-500">rata-rata</p></div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setResultsOf(e)}><BarChart3 className="h-4 w-4" /> Hasil</Button>
                    {canManage && e.is_online && <Button size="sm" variant="ghost" onClick={() => openWindow(e, 'susulan')}><CalendarPlus className="h-4 w-4" /> Susulan</Button>}
                    {canManage && e.is_online && <Button size="sm" variant="ghost" onClick={() => openWindow(e, 'remedial')}><CalendarPlus className="h-4 w-4" /> Remedial</Button>}
                    {canManage && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus ujian?') && run(() => api.remove('exams', e.id), 'Ujian dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                  </div>
                </div>
                {wins.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {wins.map((w: ExamWindow) => (
                      <span key={w.id} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs">
                        <Badge tone={w.kind === 'remedial' ? 'amber' : 'blue'}>{KIND_LABEL[w.kind]}</Badge> {fmtDate(w.date, { day: 'numeric', month: 'short' })} {w.start_time}–{w.end_time} · {w.student_ids.length} siswa
                        {canManage && <button onClick={() => confirm('Hapus jadwal ini?') && run(() => api.action('exams.windowDelete', { id: w.id }), 'Jadwal dihapus')} className="text-red-500 hover:text-red-700" aria-label="Hapus jadwal">×</button>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!list.length && <Empty text="Tidak ada ujian" />}
      </Card>

      {builder && <ExamBuilder initial={builder} scope={scope} onClose={() => setBuilder(null)} />}

      <Modal open={!!win} onClose={() => setWin(null)} title={`Jadwalkan Ujian ${win ? KIND_LABEL[win.kind] : ''}`} size="lg" footer={<Button onClick={() => run(async () => { await api.action('exams.windowCreate', { exam_id: win!.exam.id, kind: win!.kind, date: win!.date, start_time: win!.start_time, end_time: win!.end_time, student_ids: win!.student_ids, notes: win!.notes }); setWin(null); }, `Jadwal ${win?.kind} dibuat — siswa dapat mengerjakan sesuai jadwal`)}>Simpan Jadwal</Button>}>
        {win && (
          <div className="space-y-4 text-sm">
            <p><b>{win.exam.name}</b> · durasi {win.exam.duration} menit · {win.kind === 'remedial' ? `nilai remedial dihitung maksimal KKTP (${kkmOf(win.exam)})` : 'untuk siswa yang belum mengikuti ujian'}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tanggal"><Input type="date" value={win.date} onChange={(x) => setWin({ ...win, date: x.target.value })} /></Field>
              <Field label="Dibuka"><Input type="time" value={win.start_time} onChange={(x) => setWin({ ...win, start_time: x.target.value })} /></Field>
              <Field label="Ditutup"><Input type="time" value={win.end_time} onChange={(x) => setWin({ ...win, end_time: x.target.value })} /></Field>
            </div>
            <Field label={`Peserta (${win.student_ids.length})`}>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {members(win.exam).map((s) => {
                  const score = eff(win.exam, s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={win.student_ids.includes(s.id)} onChange={(x) => setWin({ ...win, student_ids: x.target.checked ? [...win.student_ids, s.id] : win.student_ids.filter((i) => i !== s.id) })} />
                      {s.name} <span className="text-xs text-slate-400">{score === null ? 'belum ujian' : `nilai ${score}`}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Catatan"><Input value={win.notes} onChange={(x) => setWin({ ...win, notes: x.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!resultsOf} onClose={() => setResultsOf(null)} title={`Hasil: ${resultsOf?.name}`} size="lg" footer={canManage && resultsOf && <Button onClick={() => syncGrades(resultsOf)}>Kirim ke Buku Nilai ({resultsOf.type === 'PTS' ? 'PTS' : resultsOf.type === 'PAS' || resultsOf.type === 'PAT' ? 'PAS' : 'Harian'})</Button>}>
        {resultsOf && (() => {
          const kkm = kkmOf(resultsOf);
          const studs = members(resultsOf);
          const effs = studs.map((s) => eff(resultsOf, s.id)).filter((v): v is number => v !== null);
          const byKind = (sid: number, k: string) => resOf(resultsOf).find((r) => r.student_id === sid && (k === 'remedial' ? r.kind === 'remedial' : r.kind !== 'remedial')) as ExamResult | undefined;
          return (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Rata-rata" value={round(avg(effs), 1) ?? '-'} />
                <StatCard label="Tertinggi" value={effs.length ? Math.max(...effs) : '-'} />
                <StatCard label="Belum Ujian" value={studs.length - effs.length} />
                <StatCard label={`Tuntas (≥${kkm})`} value={`${effs.filter((x) => x >= kkm).length}/${studs.length}`} />
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Siswa</th><th className="text-center">Utama/Susulan</th><th className="text-center">Remedial</th><th className="text-center">Esai</th><th className="text-right">Nilai Akhir</th></tr></thead>
                <tbody>
                  {studs.map((s) => {
                    const m = byKind(s.id, 'main');
                    const rm = byKind(s.id, 'remedial');
                    const e2 = eff(resultsOf, s.id);
                    const going = data.exam_attempts.some((a) => a.exam_id === resultsOf.id && a.student_id === s.id && !a.submitted_at);
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-2"><span className="flex items-center gap-2"><Avatar name={s.name} className="h-7 w-7 text-[10px]" />{s.name}</span></td>
                        <td className="text-center">{m ? <>{m.score}{m.kind === 'susulan' && <Badge tone="blue" className="ml-1">susulan</Badge>}{m.pending_essay && <Badge tone="amber" className="ml-1">sementara</Badge>}</> : going ? <Badge tone="green">mengerjakan</Badge> : <Badge>belum</Badge>}</td>
                        <td className="text-center">{rm ? rm.score : '-'}</td>
                        <td className="text-center">{[m, rm].filter((x): x is ExamResult => !!x && resultsOf.questions.some((qq) => qType(qq) === 'esai')).map((x) => (
                          <Button key={x.id} size="sm" variant={x.pending_essay ? 'primary' : 'ghost'} onClick={() => setGrading({ exam: resultsOf, result: x, points: Object.fromEntries(resultsOf.questions.map((qq, qi) => [qi, x.points?.[qi] != null && qType(qq) === 'esai' ? String(x.points[qi]) : ''])) })}>
                            {x.pending_essay ? 'Koreksi' : 'Ubah'}{x.kind === 'remedial' ? ' (R)' : ''}
                          </Button>
                        ))}</td>
                        <td className="text-right">{e2 !== null ? <span className={cn('font-bold', e2 >= kkm ? 'text-emerald-600' : 'text-red-600')}>{e2}</span> : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">Nilai akhir = nilai utama/susulan; bila remedial lebih tinggi, dipakai nilai remedial maksimal KKTP.</p>
            </>
          );
        })()}
      </Modal>

      <Modal open={!!grading} onClose={() => setGrading(null)} title={`Koreksi Esai · ${scope.students.find((x) => x.id === grading?.result.student_id)?.name || ''}`} size="lg"
        footer={<Button onClick={() => run(async () => {
          const pts: Record<number, number | null> = {};
          Object.entries(grading!.points).forEach(([k, v]) => { if (qType(grading!.exam.questions[Number(k)]) === 'esai') pts[Number(k)] = v === '' ? null : Number(v); });
          await api.action('exams.gradeEssay', { result_id: grading!.result.id, points: pts });
          setGrading(null);
        }, 'Nilai esai disimpan — nilai akhir diperbarui')}>Simpan Nilai</Button>}>
        {grading && (
          <div className="space-y-5">
            {grading.exam.questions.map((qq, qi) => qType(qq) !== 'esai' ? null : (
              <div key={qi} className="rounded-lg border border-slate-200 p-4 text-sm">
                <p className="font-medium">{qi + 1}. {qq.q}</p>
                <div className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3">{typeof grading.result.answers[qi] === 'string' && (grading.result.answers[qi] as string).trim() ? (grading.result.answers[qi] as string) : <span className="text-slate-400">(tidak dijawab — otomatis 0)</span>}</div>
                {qq.key && <p className="mt-2 text-xs text-emerald-800"><b>Kunci/rubrik:</b> {qq.key}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-slate-500">Nilai</span>
                  <Input type="number" min={0} max={qPoints(qq)} className="w-24" value={grading.points[qi] ?? ''} disabled={!(typeof grading.result.answers[qi] === 'string' && (grading.result.answers[qi] as string).trim())} onChange={(x) => setGrading({ ...grading, points: { ...grading.points, [qi]: x.target.value } })} />
                  <span className="text-slate-500">/ {qPoints(qq)} poin</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">Nilai objektif sudah dihitung otomatis. Nilai akhir = total poin diperoleh ÷ total bobot × 100.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function ExamBuilder({ initial, scope, onClose }: { initial: Partial<Exam>; scope: LearningScope; onClose: () => void }) {
  const [e, setE] = useState<Partial<Exam>>(initial);
  const qs = e.questions || [];
  const save = () => run(async () => {
    if (!e.name) throw new Error('Nama ujian wajib diisi');
    if (e.is_online) validateQuestions(qs);
    if (!e.start_time || !e.end_time || e.end_time <= e.start_time) throw new Error('Jam tutup harus setelah jam mulai');
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
        <Field label="Jam Dibuka"><Input type="time" value={e.start_time} onChange={(x) => setE({ ...e, start_time: x.target.value })} /></Field>
        <Field label="Jam Ditutup" hint="Siswa tidak dapat mulai/mengerjakan setelah jam ini"><Input type="time" value={e.end_time} onChange={(x) => setE({ ...e, end_time: x.target.value })} /></Field>
        <Field label="Durasi Pengerjaan (menit)" hint="Dihitung sejak siswa menekan Mulai"><Input type="number" value={e.duration} onChange={(x) => setE({ ...e, duration: Number(x.target.value) })} /></Field>
        <Field label="Mode"><Select value={e.is_online ? '1' : '0'} onChange={(x) => setE({ ...e, is_online: x.target.value === '1' })} options={[{ value: '1', label: 'CBT Online (pilihan ganda)' }, { value: '0', label: 'Tertulis / luring' }]} /></Field>
      </div>
      {e.is_online && <div className="mt-6"><QuestionEditor questions={qs} onChange={(questions) => setE({ ...e, questions })} /></div>}
    </Modal>
  );
}
