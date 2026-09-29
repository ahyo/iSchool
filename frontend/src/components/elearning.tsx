'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, ExternalLink, Eye, EyeOff, FileText, HelpCircle,
  MessageSquare, Pencil, Pin, Plus, PlayCircle, Radio, Send, Trash2, Users, Video,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { LearningScope } from '@/lib/useLearningScope';
import type { AnswerValue, Discussion, Lesson, LessonProgress, LessonType, Student, VirtualClass } from '@/lib/types';
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, ProgressBar, Select, Tabs, Textarea, run } from './ui';
import { FormModal } from './FormModal';
import { QuestionEditor, emptyQuestion, validateQuestions } from './QuestionEditor';
import { QuestionInput } from './QuestionInput';
import { emptyAnswer, isAnswered } from '@/lib/scoring';
import { cn, downloadCSV, fmtDate, fmtDateTime, nowISO, today } from '@/lib/utils';

export type Course = { class_id: number; subject_id: number };
export const courseKey = (c: Course) => `${c.class_id}-${c.subject_id}`;

const TYPE_META: Record<LessonType, { label: string; icon: React.ElementType; tone: string }> = {
  teks: { label: 'Bacaan', icon: FileText, tone: 'text-blue-600 bg-blue-50' },
  video: { label: 'Video', icon: PlayCircle, tone: 'text-rose-600 bg-rose-50' },
  dokumen: { label: 'Dokumen', icon: Download, tone: 'text-amber-600 bg-amber-50' },
  kuis: { label: 'Kuis', icon: HelpCircle, tone: 'text-violet-600 bg-violet-50' },
};

/** Ubah URL video (YouTube/Vimeo/Google Drive/file langsung) menjadi sumber pemutar. */
export function videoSource(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (drive) return { kind: 'iframe', src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { kind: 'video', src: url };
}

function VideoPlayer({ url }: { url: string }) {
  const s = videoSource(url);
  if (!s) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Video belum tersedia.</p>;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      {s.kind === 'iframe' ? (
        <iframe src={s.src} className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="Video pembelajaran" />
      ) : (
        <video src={s.src} controls className="h-full w-full" />
      )}
    </div>
  );
}

export interface ELData {
  lessons: Lesson[];
  lesson_progress: LessonProgress[];
  virtual_classes: VirtualClass[];
  discussions: Discussion[];
}

/** Hitung progres satu siswa pada sebuah kursus. */
export function courseProgress(data: ELData, course: Course, studentId: number) {
  const lessons = data.lessons.filter((l) => l.class_id === course.class_id && l.subject_id === course.subject_id && l.is_published);
  const ids = new Set(lessons.map((l) => l.id));
  const done = data.lesson_progress.filter((p) => p.student_id === studentId && ids.has(p.lesson_id)).length;
  return { total: lessons.length, done, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

/* =============================== KATALOG =============================== */
export function CourseCatalog({ scope, data, onOpen }: { scope: LearningScope; data: ELData; onOpen: (c: Course, tab?: CourseTab) => void }) {
  const [classId, setClassId] = useState('');
  const staff = !scope.student;
  const courses = scope.pairs
    .filter((p) => !classId || p.class_id === Number(classId))
    .filter((p) => scope.isTeacher || data.lessons.some((l) => l.class_id === p.class_id && l.subject_id === p.subject_id && (staff || l.is_published)));
  const todayClasses = data.virtual_classes.filter((v) => v.date === today() && scope.pairAllowed(v.class_id, v.subject_id)).sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <>
      {todayClasses.length > 0 && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/50" title={<span className="flex items-center gap-2 text-emerald-800"><Radio className="h-4 w-4" /> Kelas Virtual Hari Ini</span>}>
          <div className="flex flex-wrap gap-2">
            {todayClasses.map((v) => (
              <button key={v.id} onClick={() => onOpen({ class_id: v.class_id, subject_id: v.subject_id }, 'virtual')} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400">
                <p className="font-medium">{v.title}</p>
                <p className="text-xs text-slate-500">{scope.subjects.get(v.subject_id)?.name} · {scope.classes.get(v.class_id)?.name} · {v.start_time}–{v.end_time}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
      {staff && scope.classList.length > 1 && (
        <div className="mb-4"><Select className="w-52" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={scope.classList.map((c) => ({ value: c.id, label: c.name }))} /></div>
      )}
      {courses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => {
            const lessons = data.lessons.filter((l) => l.class_id === c.class_id && l.subject_id === c.subject_id && (staff || l.is_published));
            const modules = new Set(lessons.map((l) => l.module)).size;
            const members = scope.students.filter((s) => s.class_id === c.class_id && s.status === 'aktif');
            const pct = scope.student
              ? courseProgress(data, c, scope.student.id).pct
              : members.length ? Math.round(members.reduce((a, m) => a + courseProgress(data, c, m.id).pct, 0) / members.length) : 0;
            const next = data.virtual_classes.filter((v) => v.class_id === c.class_id && v.subject_id === c.subject_id && v.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
            const teacherId = data.lessons.find((l) => l.class_id === c.class_id && l.subject_id === c.subject_id)?.teacher_id;
            return (
              <button key={courseKey(c)} onClick={() => onOpen(c)} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-brand-300 hover:shadow-md">
                <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
                  <p className="text-xs uppercase tracking-wide text-brand-100">{scope.classes.get(c.class_id)?.name}</p>
                  <p className="mt-1 text-lg font-bold leading-tight">{scope.subjects.get(c.subject_id)?.name}</p>
                  <p className="mt-1 text-xs text-brand-100">{scope.employees.get(teacherId || 0)?.name || 'Guru pengampu'}</p>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
                  <div className="flex gap-3 text-slate-500">
                    <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {modules} modul</span>
                    <span className="flex items-center gap-1"><FileText className="h-4 w-4" /> {lessons.length} pelajaran</span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{scope.student ? 'Progres saya' : 'Rata-rata progres kelas'}</span><span className="font-semibold text-slate-700">{pct}%</span></div>
                    <ProgressBar value={pct} tone={pct >= 80 ? 'green' : pct >= 40 ? 'blue' : 'amber'} />
                  </div>
                  {next && <p className="mt-auto flex items-center gap-1.5 text-xs text-emerald-700"><Video className="h-3.5 w-3.5" /> Kelas virtual {next.date === today() ? 'hari ini' : fmtDate(next.date, { day: 'numeric', month: 'short' })} · {next.start_time}</p>}
                </div>
              </button>
            );
          })}
        </div>
      ) : <Card><Empty text="Belum ada kelas online" /></Card>}
    </>
  );
}

/* =============================== KURSUS =============================== */
export type CourseTab = 'pelajaran' | 'virtual' | 'diskusi' | 'progres';

export function CourseView({ scope, data, course, onBack, initialTab }: { scope: LearningScope; data: ELData; course: Course; onBack: () => void; initialTab?: CourseTab }) {
  const staff = !scope.student;
  const canManage = scope.role === 'admin' || (scope.isTeacher && scope.pairAllowed(course.class_id, course.subject_id));
  const [tab, setTab] = useState<CourseTab>(initialTab || 'pelajaran');
  const lessons = useMemo(
    () => data.lessons.filter((l) => l.class_id === course.class_id && l.subject_id === course.subject_id && (staff || l.is_published)).sort((a, b) => a.module.localeCompare(b.module) || a.order - b.order),
    [data.lessons, course, staff],
  );
  const members = scope.students.filter((s) => s.class_id === course.class_id && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name));
  const prog = scope.student ? courseProgress(data, course, scope.student.id) : null;
  const threads = data.discussions.filter((d) => d.class_id === course.class_id && d.subject_id === course.subject_id && !d.parent_id).length;
  const tabs: { value: CourseTab; label: string }[] = [
    { value: 'pelajaran', label: `Pelajaran (${lessons.length})` },
    { value: 'virtual', label: 'Kelas Virtual' },
    { value: 'diskusi', label: `Diskusi (${threads})` },
    ...(staff ? [{ value: 'progres' as const, label: 'Progres Siswa' }] : []),
  ];

  return (
    <>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4" /> Semua kelas online</button>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-800 p-5 text-white">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-brand-100">{scope.classes.get(course.class_id)?.name}{staff && ` · ${members.length} siswa`}</p>
          <p className="text-xl font-bold">{scope.subjects.get(course.subject_id)?.name}</p>
        </div>
        {prog && (
          <div className="w-56">
            <div className="mb-1 flex justify-between text-xs text-brand-100"><span>{prog.done}/{prog.total} pelajaran selesai</span><span className="font-semibold text-white">{prog.pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${prog.pct}%` }} /></div>
          </div>
        )}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'pelajaran' && <LessonsPane scope={scope} data={data} course={course} lessons={lessons} canManage={canManage} />}
      {tab === 'virtual' && <VirtualPane scope={scope} data={data} course={course} canManage={canManage} members={members} />}
      {tab === 'diskusi' && <DiscussionPane scope={scope} data={data} course={course} />}
      {tab === 'progres' && staff && <ProgressPane scope={scope} data={data} course={course} lessons={lessons.filter((l) => l.is_published)} members={members} />}
    </>
  );
}

/* ----------------------------- Pelajaran ----------------------------- */
function LessonsPane({ scope, data, course, lessons, canManage }: { scope: LearningScope; data: ELData; course: Course; lessons: Lesson[]; canManage: boolean }) {
  const student = scope.student;
  const doneIds = new Set(student ? data.lesson_progress.filter((p) => p.student_id === student.id).map((p) => p.lesson_id) : []);
  const firstTodo = lessons.find((l) => !doneIds.has(l.id));
  const [activeId, setActiveId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<Lesson> | null>(null);
  useEffect(() => {
    if (activeId && lessons.some((l) => l.id === activeId)) return;
    setActiveId((firstTodo || lessons[0])?.id ?? null);
  }, [lessons, activeId, firstTodo]);

  const modules = [...new Set(lessons.map((l) => l.module))];
  const active = lessons.find((l) => l.id === activeId) || null;
  const idx = active ? lessons.indexOf(active) : -1;
  const progress = active && student ? data.lesson_progress.find((p) => p.lesson_id === active.id && p.student_id === student.id) : undefined;
  const lastModule = modules[modules.length - 1] || 'Bab 1 · Pengantar';

  if (!lessons.length) {
    return (
      <Card>
        <Empty text="Belum ada pelajaran di kelas online ini" />
        {canManage && <div className="text-center"><Button onClick={() => setEdit({ ...course, module: 'Bab 1 · Pengantar', order: 1, type: 'teks', is_published: true, duration: 10 })}><Plus className="h-4 w-4" /> Tambah Pelajaran Pertama</Button></div>}
        {edit && <LessonEditor initial={edit} scope={scope} modules={modules} onClose={() => setEdit(null)} />}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card bodyClass="p-0" className="self-start" title="Daftar Pelajaran" actions={canManage && <Button size="sm" onClick={() => setEdit({ ...course, module: lastModule, order: lessons.filter((l) => l.module === lastModule).length + 1, type: 'teks', is_published: true, duration: 10 })}><Plus className="h-4 w-4" /></Button>}>
        {modules.map((m) => (
          <div key={m} className="border-b border-slate-100 last:border-0">
            <p className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{m}</p>
            {lessons.filter((l) => l.module === m).map((l) => {
              const Icon = TYPE_META[l.type].icon;
              const done = doneIds.has(l.id);
              return (
                <button key={l.id} onClick={() => setActiveId(l.id)} className={cn('flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition', l.id === activeId ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50')}>
                  {student ? (done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />) : <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{l.title}</span>
                    <span className="text-xs text-slate-500">{TYPE_META[l.type].label} · {l.duration} mnt{!l.is_published && ' · Draf'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </Card>

      {active && (
        <Card
          title={<span className="flex items-center gap-2"><span className={cn('rounded-md p-1.5', TYPE_META[active.type].tone)}>{(() => { const I = TYPE_META[active.type].icon; return <I className="h-4 w-4" />; })()}</span>{active.title}</span>}
          actions={<>
            {!active.is_published && <Badge tone="amber">Draf</Badge>}
            {canManage && (
              <>
                <Button size="sm" variant="ghost" title={active.is_published ? 'Jadikan draf' : 'Publikasikan'} onClick={() => run(() => api.update('lessons', active.id, { is_published: !active.is_published }), active.is_published ? 'Pelajaran dijadikan draf' : 'Pelajaran dipublikasikan')}>{active.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                <Button size="sm" variant="ghost" title="Ubah" onClick={() => setEdit(active)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" title="Hapus" onClick={() => confirm('Hapus pelajaran ini?') && run(() => api.remove('lessons', active.id), 'Pelajaran dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </>
            )}
          </>}
        >
          <p className="mb-4 text-xs text-slate-500">{active.module} · {TYPE_META[active.type].label} · ± {active.duration} menit</p>
          {active.type === 'video' && <div className="mb-4"><VideoPlayer url={active.video_url} /></div>}
          {active.content && <div className="mb-4 whitespace-pre-line leading-relaxed text-slate-700">{active.content}</div>}
          {active.type === 'dokumen' && (
            <a href={active.file_url} target="_blank" rel="noreferrer" className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300">
              <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600"><FileText className="h-6 w-6" /></div>
              <div className="flex-1"><p className="font-medium">Buka / unduh dokumen</p><p className="truncate text-xs text-slate-500">{active.file_url || '-'}</p></div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>
          )}
          {active.type === 'kuis' && <QuizBlock lesson={active} scope={scope} progress={progress} />}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" size="sm" disabled={idx <= 0} onClick={() => setActiveId(lessons[idx - 1].id)}><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button>
            {student && scope.role === 'siswa' && active.type !== 'kuis' && (
              progress ? <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Selesai {fmtDateTime(progress.completed_at)}</span> : (
                <Button variant="success" size="sm" onClick={() => run(async () => { await api.action('elearning.complete', { lesson_id: active.id, student_id: student.id }); if (idx < lessons.length - 1) setActiveId(lessons[idx + 1].id); }, 'Pelajaran ditandai selesai')}><CheckCircle2 className="h-4 w-4" /> Tandai Selesai</Button>
              )
            )}
            {scope.role === 'ortu' && (progress ? <Badge tone="green">Sudah diselesaikan anak</Badge> : <Badge>Belum diselesaikan</Badge>)}
            <Button variant="secondary" size="sm" disabled={idx >= lessons.length - 1} onClick={() => setActiveId(lessons[idx + 1].id)}>Berikutnya <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}
      {edit && <LessonEditor initial={edit} scope={scope} modules={modules} onClose={() => setEdit(null)} />}
    </div>
  );
}

function QuizBlock({ lesson, scope, progress }: { lesson: Lesson; scope: LearningScope; progress?: LessonProgress }) {
  const [answers, setAnswers] = useState<AnswerValue[]>(() => lesson.quiz.map(emptyAnswer));
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAnswers(lesson.quiz.map(emptyAnswer)); setResult(null); }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const isStudent = scope.role === 'siswa';
  const showKey = !scope.student; // guru/staf melihat kunci jawaban

  const submit = async () => {
    setBusy(true);
    const r = await run(() => api.action<{ score: number; correct: number; total: number }>('elearning.complete', { lesson_id: lesson.id, student_id: scope.student!.id, answers }));
    if (r) setResult(r);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {progress?.quiz_score != null && !result && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nilai terbaik: <b>{progress.quiz_score}</b>{isStudent && ' — kamu dapat mengulang kuis untuk memperbaiki nilai.'}</p>}
      {lesson.quiz.map((q, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-4">
          <p className="mb-2 font-medium">{i + 1}. {q.q}</p>
          <QuestionInput q={q} value={answers[i]} compact disabled={!isStudent} showKey={showKey} onChange={(v) => setAnswers(answers.map((a, j) => (j === i ? v : a)))} />
        </div>
      ))}
      {result && (
        <div className={cn('rounded-xl p-4 text-center', result.score >= 70 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
          <p className="text-3xl font-extrabold">{result.score}</p>
          <p className="text-sm">{result.correct} dari {result.total} soal benar · {result.score >= 70 ? 'Tuntas!' : 'Belum tuntas, pelajari lagi lalu ulangi kuis.'}</p>
        </div>
      )}
      {isStudent && <Button loading={busy} disabled={lesson.quiz.some((q, i) => !isAnswered(q, answers[i]))} onClick={submit}><Send className="h-4 w-4" /> {result || progress ? 'Kirim Ulang Jawaban' : 'Kirim Jawaban'}</Button>}
    </div>
  );
}

function LessonEditor({ initial, scope, modules, onClose }: { initial: Partial<Lesson>; scope: LearningScope; modules: string[]; onClose: () => void }) {
  const [l, setL] = useState<Partial<Lesson>>({ content: '', video_url: '', file_url: '', quiz: [], ...initial });
  const set = (k: keyof Lesson, v: unknown) => setL((x) => ({ ...x, [k]: v }));
  const save = () => run(async () => {
    if (!l.title?.trim()) throw new Error('Judul pelajaran wajib diisi');
    if (!l.module?.trim()) throw new Error('Nama modul wajib diisi');
    if (l.type === 'video' && !l.video_url) throw new Error('Isi tautan video');
    if (l.type === 'dokumen' && !l.file_url) throw new Error('Isi tautan dokumen');
    if (l.type === 'kuis') validateQuestions(l.quiz || []);
    const payload = { ...l, order: Number(l.order) || 1, duration: Number(l.duration) || 10, quiz: l.type === 'kuis' ? l.quiz : [] };
    if (l.id) await api.update('lessons', l.id, payload);
    else {
      const teacher_id = scope.employee?.id || (await api.list('schedules', { class_id: l.class_id, subject_id: l.subject_id }))[0]?.teacher_id || 0;
      await api.create('lessons', { ...payload, teacher_id, created_at: nowISO() });
    }
    onClose();
  }, 'Pelajaran disimpan');

  return (
    <Modal open onClose={onClose} title={l.id ? 'Ubah Pelajaran' : 'Tambah Pelajaran'} size="xl" footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save}>Simpan</Button></>}>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Judul" required className="sm:col-span-3"><Input value={l.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Jenis"><Select value={l.type} onChange={(e) => { set('type', e.target.value); if (e.target.value === 'kuis' && !l.quiz?.length) set('quiz', [emptyQuestion()]); }} options={Object.entries(TYPE_META).map(([v, m]) => ({ value: v, label: m.label }))} /></Field>
        <Field label="Modul / Bab" required className="sm:col-span-2" hint="Ketik nama modul baru atau pilih yang sudah ada">
          <Input list="module-list" value={l.module || ''} onChange={(e) => set('module', e.target.value)} />
          <datalist id="module-list">{modules.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Urutan"><Input type="number" min={1} value={l.order ?? 1} onChange={(e) => set('order', e.target.value)} /></Field>
        <Field label="Durasi (menit)"><Input type="number" min={1} value={l.duration ?? 10} onChange={(e) => set('duration', e.target.value)} /></Field>
        {l.type === 'video' && <Field label="Tautan Video" required className="sm:col-span-4" hint="YouTube, Vimeo, Google Drive, atau file .mp4"><Input value={l.video_url || ''} onChange={(e) => set('video_url', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></Field>}
        {l.type === 'dokumen' && <Field label="Tautan Dokumen" required className="sm:col-span-4" hint="PDF/Slide di Google Drive, OneDrive, atau tautan unduhan"><Input value={l.file_url || ''} onChange={(e) => set('file_url', e.target.value)} /></Field>}
        <Field label={l.type === 'teks' ? 'Isi Bacaan' : 'Petunjuk / Deskripsi'} className="sm:col-span-4"><Textarea rows={l.type === 'teks' ? 10 : 3} value={l.content || ''} onChange={(e) => set('content', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={!!l.is_published} onChange={(e) => set('is_published', e.target.checked)} /> Publikasikan ke siswa</label>
      </div>
      {l.type === 'video' && l.video_url && <div className="mt-4"><p className="mb-2 text-sm font-medium">Pratinjau</p><VideoPlayer url={l.video_url} /></div>}
      {l.type === 'kuis' && <div className="mt-6"><QuestionEditor questions={l.quiz || []} allowEssay={false} onChange={(q) => set('quiz', q)} /></div>}
    </Modal>
  );
}

/* ----------------------------- Kelas Virtual ----------------------------- */
function VirtualPane({ scope, data, course, canManage, members }: { scope: LearningScope; data: ELData; course: Course; canManage: boolean; members: Student[] }) {
  const [edit, setEdit] = useState<Partial<VirtualClass> | null>(null);
  const [attendees, setAttendees] = useState<VirtualClass | null>(null);
  const [recording, setRecording] = useState<VirtualClass | null>(null);
  const list = data.virtual_classes.filter((v) => v.class_id === course.class_id && v.subject_id === course.subject_id);
  const upcoming = list.filter((v) => v.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const past = list.filter((v) => v.date < today()).sort((a, b) => b.date.localeCompare(a.date));
  const student = scope.student;

  const join = async (v: VirtualClass) => {
    const w = window.open('', '_blank');
    const r = await run(() => api.action<{ link: string }>('elearning.join', { virtual_class_id: v.id, student_id: student?.id ?? 0 }));
    if (r?.link && w) w.location.href = r.link;
    else w?.close();
  };

  const row = (v: VirtualClass, isPast: boolean) => {
    const isToday = v.date === today();
    const attended = student ? v.attendee_ids.includes(student.id) : false;
    return (
      <div key={v.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className={cn('flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg', isToday ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600')}>
          <span className="font-bold leading-none">{new Date(v.date + 'T00:00:00').getDate()}</span>
          <span className="text-[10px]">{fmtDate(v.date, { month: 'short' })}</span>
        </div>
        <div className="min-w-[200px] flex-1">
          <p className="font-medium">{v.title} {isToday && <Badge tone="green" className="ml-1">Hari ini</Badge>}</p>
          <p className="text-xs text-slate-500">{v.start_time}–{v.end_time} · {v.platform} · {v.description}</p>
        </div>
        <span className="flex items-center gap-1 text-sm text-slate-500" title="Kehadiran"><Users className="h-4 w-4" /> {v.attendee_ids.length}/{members.length}</span>
        <div className="flex flex-wrap gap-1">
          {!isPast && scope.role === 'siswa' && <Button size="sm" variant={isToday ? 'success' : 'secondary'} disabled={!isToday} onClick={() => join(v)}><Video className="h-4 w-4" /> {isToday ? 'Gabung' : 'Belum dibuka'}</Button>}
          {!isPast && canManage && <Button size="sm" variant="success" onClick={() => window.open(v.link, '_blank')}><Video className="h-4 w-4" /> Mulai</Button>}
          {isPast && v.recording_url && <Button size="sm" variant="secondary" onClick={() => setRecording(v)}><PlayCircle className="h-4 w-4" /> Rekaman</Button>}
          {student && isPast && (attended ? <Badge tone="green">Hadir</Badge> : <Badge tone="red">Tidak hadir</Badge>)}
          {!student && <Button size="sm" variant="ghost" onClick={() => setAttendees(v)}>Kehadiran</Button>}
          {canManage && <Button size="sm" variant="ghost" onClick={() => setEdit(v)}><Pencil className="h-4 w-4" /></Button>}
          {canManage && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus jadwal kelas virtual?') && run(() => api.remove('virtual_classes', v.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
        </div>
      </div>
    );
  };

  const slug = `iSchool-${scope.classes.get(course.class_id)?.name}-${scope.subjects.get(course.subject_id)?.code}`.replace(/\s+/g, '');
  return (
    <>
      <Card title="Jadwal Kelas Virtual" bodyClass="p-0" actions={canManage && <Button size="sm" onClick={() => setEdit({ ...course, date: today(), start_time: '13:00', end_time: '14:00', platform: 'Jitsi', link: '', recording_url: '', description: '', attendee_ids: [] })}><Plus className="h-4 w-4" /> Jadwalkan</Button>}>
        <div className="divide-y divide-slate-100">{upcoming.map((v) => row(v, false))}</div>
        {!upcoming.length && <Empty text="Belum ada kelas virtual terjadwal" />}
      </Card>
      <Card title="Riwayat & Rekaman" bodyClass="p-0" className="mt-4">
        <div className="divide-y divide-slate-100">{past.map((v) => row(v, true))}</div>
        {!past.length && <Empty />}
      </Card>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Kelas Virtual' : 'Jadwalkan Kelas Virtual'} initial={edit || undefined}
        fields={[
          { name: 'title', label: 'Judul Sesi', required: true, full: true },
          { name: 'date', label: 'Tanggal', type: 'date', required: true },
          { name: 'platform', label: 'Platform', type: 'select', options: ['Jitsi', 'Google Meet', 'Zoom', 'Microsoft Teams'].map((x) => ({ value: x, label: x })) },
          { name: 'start_time', label: 'Mulai', type: 'time', required: true },
          { name: 'end_time', label: 'Selesai', type: 'time', required: true },
          { name: 'link', label: 'Tautan Rapat', full: true, hint: 'Kosongkan untuk membuat ruang Jitsi otomatis' },
          { name: 'recording_url', label: 'Tautan Rekaman (setelah sesi)', full: true },
          { name: 'description', label: 'Agenda / Keterangan', type: 'textarea' },
        ]}
        onSubmit={(v) => run(async () => {
          const payload = { ...v, link: v.link || `https://meet.jit.si/${slug}-${Date.now().toString(36)}`, recording_url: v.recording_url || '', description: v.description || '' };
          if (v.id) await api.update('virtual_classes', v.id, payload);
          else {
            const teacher_id = scope.employee?.id || (await api.list('schedules', { class_id: course.class_id, subject_id: course.subject_id }))[0]?.teacher_id || 0;
            await api.create('virtual_classes', { ...payload, ...course, teacher_id, attendee_ids: [] });
          }
          setEdit(null);
        }, 'Kelas virtual disimpan')} />

      <Modal open={!!attendees} onClose={() => setAttendees(null)} title={`Kehadiran: ${attendees?.title || ''}`}>
        {attendees && (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <Avatar name={m.name} className="h-7 w-7 text-[10px]" />
                <span className="flex-1">{m.name}</span>
                {attendees.attendee_ids.includes(m.id) ? <Badge tone="green">Hadir</Badge> : <Badge>Tidak hadir</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal open={!!recording} onClose={() => setRecording(null)} title={`Rekaman: ${recording?.title || ''}`} size="lg">
        {recording && <VideoPlayer url={recording.recording_url} />}
      </Modal>
    </>
  );
}

/* ----------------------------- Diskusi ----------------------------- */
function DiscussionPane({ scope, data, course }: { scope: LearningScope; data: ELData; course: Course }) {
  const { user } = useAuth();
  const [open, setOpen] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState({ title: '', body: '' });
  const [reply, setReply] = useState('');
  const canPost = scope.role !== 'ortu';
  const canModerate = scope.role === 'admin' || scope.role === 'guru';
  const all = data.discussions.filter((d) => d.class_id === course.class_id && d.subject_id === course.subject_id);
  const repliesOf = (id: number) => all.filter((d) => d.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lastActivity = (t: Discussion) => [t, ...repliesOf(t.id)].reduce((m, x) => (x.created_at > m ? x.created_at : m), t.created_at);
  const threads = all.filter((d) => !d.parent_id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || lastActivity(b).localeCompare(lastActivity(a)));

  const post = (payload: Record<string, unknown>, msg: string, after: () => void) => run(async () => { await api.action('discussions.post', { ...course, ...payload }); after(); }, msg);
  const roleTone = (r: string) => (r === 'guru' || r === 'admin' ? 'violet' : 'slate') as 'violet';

  return (
    <div className="space-y-4">
      {canPost && (
        <Card title="Buat Topik Baru">
          <div className="space-y-3">
            <Input placeholder="Judul topik / pertanyaan" value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} />
            <Textarea placeholder="Tuliskan pertanyaan atau bahan diskusi..." value={newTopic.body} onChange={(e) => setNewTopic({ ...newTopic, body: e.target.value })} />
            <Button size="sm" disabled={!newTopic.title.trim() || !newTopic.body.trim()} onClick={() => post(newTopic, 'Topik diskusi dibuat', () => setNewTopic({ title: '', body: '' }))}><Send className="h-4 w-4" /> Kirim Topik</Button>
          </div>
        </Card>
      )}
      {threads.map((t) => {
        const replies = repliesOf(t.id);
        const expanded = open === t.id;
        return (
          <Card key={t.id} className={cn(t.pinned && 'border-brand-200')}>
            <div className="flex items-start gap-3">
              <Avatar name={t.author} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{t.author}</span>
                  <Badge tone={roleTone(t.author_role)}>{t.author_role === 'guru' ? 'Guru' : t.author_role === 'admin' ? 'Admin' : 'Siswa'}</Badge>
                  <span>{fmtDateTime(t.created_at)}</span>
                  {t.pinned && <Badge tone="blue"><Pin className="mr-1 h-3 w-3" />Disematkan</Badge>}
                </div>
                <p className="mt-1 font-semibold">{t.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{t.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setOpen(expanded ? null : t.id); setReply(''); }}><MessageSquare className="h-4 w-4" /> {replies.length} balasan</Button>
                  {canModerate && <Button size="sm" variant="ghost" onClick={() => run(() => api.action('discussions.pin', { id: t.id }), t.pinned ? 'Sematan dilepas' : 'Topik disematkan')}><Pin className="h-4 w-4" /> {t.pinned ? 'Lepas' : 'Sematkan'}</Button>}
                  {(canModerate || t.user_id === user?.id) && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus topik beserta balasannya?') && run(() => api.action('discussions.delete', { id: t.id }), 'Topik dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
                {expanded && (
                  <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
                    {replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2.5">
                        <Avatar name={r.author} className="h-7 w-7 text-[10px]" />
                        <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">{r.author}</span>
                            {(r.author_role === 'guru' || r.author_role === 'admin') && <Badge tone="violet">Guru</Badge>}
                            <span>{fmtDateTime(r.created_at)}</span>
                            {(canModerate || r.user_id === user?.id) && <button className="ml-auto text-red-500 hover:underline" onClick={() => confirm('Hapus balasan?') && run(() => api.action('discussions.delete', { id: r.id }), 'Balasan dihapus')}>Hapus</button>}
                          </div>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{r.body}</p>
                        </div>
                      </div>
                    ))}
                    {canPost && (
                      <div className="flex gap-2">
                        <Input placeholder="Tulis balasan..." value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && reply.trim()) post({ parent_id: t.id, body: reply }, 'Balasan terkirim', () => setReply('')); }} />
                        <Button size="sm" disabled={!reply.trim()} onClick={() => post({ parent_id: t.id, body: reply }, 'Balasan terkirim', () => setReply(''))}><Send className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      {!threads.length && <Card><Empty text="Belum ada diskusi" /></Card>}
    </div>
  );
}

/* ----------------------------- Progres ----------------------------- */
function ProgressPane({ scope, data, course, lessons, members }: { scope: LearningScope; data: ELData; course: Course; lessons: Lesson[]; members: Student[] }) {
  const prog = (sid: number, lid: number) => data.lesson_progress.find((p) => p.student_id === sid && p.lesson_id === lid);
  const rows = members.map((m) => {
    const done = lessons.filter((l) => prog(m.id, l.id));
    const quizzes = lessons.filter((l) => l.type === 'kuis').map((l) => prog(m.id, l.id)?.quiz_score).filter((x): x is number => x != null);
    return { m, done: done.length, pct: lessons.length ? Math.round((done.length / lessons.length) * 100) : 0, quiz: quizzes.length ? Math.round(quizzes.reduce((a, b) => a + b, 0) / quizzes.length) : null };
  });
  const name = `${scope.classes.get(course.class_id)?.name}-${scope.subjects.get(course.subject_id)?.code}`;
  return (
    <Card title="Progres Belajar Siswa" bodyClass="p-0 overflow-x-auto" actions={<Button size="sm" variant="secondary" onClick={() => downloadCSV(`progres-elearning-${name}.csv`, [['NIS', 'Nama', 'Selesai', 'Total', '% Progres', 'Rata-rata Kuis', ...lessons.map((l) => l.title)], ...rows.map((r) => [r.m.nis, r.m.name, r.done, lessons.length, r.pct, r.quiz, ...lessons.map((l) => { const p = prog(r.m.id, l.id); return p ? (p.quiz_score ?? 'selesai') : ''; })])])}><Download className="h-4 w-4" /> CSV</Button>}>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-500">
            <th className="px-4 py-2 text-left">Siswa</th>
            {lessons.map((l, i) => <th key={l.id} className="px-1 text-center" title={`${l.module} — ${l.title}`}>{i + 1}</th>)}
            <th className="px-2 text-center">Kuis</th>
            <th className="w-40 px-4 text-left">Progres</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.m.id} className="border-b border-slate-100">
              <td className="whitespace-nowrap px-4 py-2">{r.m.name}</td>
              {lessons.map((l) => {
                const p = prog(r.m.id, l.id);
                return <td key={l.id} className="px-1 text-center">{p ? (l.type === 'kuis' ? <span className={cn('text-xs font-semibold', (p.quiz_score ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600')}>{p.quiz_score}</span> : <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />) : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</td>;
              })}
              <td className="px-2 text-center font-semibold">{r.quiz ?? '-'}</td>
              <td className="px-4"><div className="flex items-center gap-2"><ProgressBar value={r.pct} tone={r.pct >= 80 ? 'green' : r.pct >= 40 ? 'blue' : 'amber'} /><span className="w-9 text-right text-xs">{r.pct}%</span></div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!members.length && <Empty />}
      <p className="px-4 py-3 text-xs text-slate-500">Nomor kolom = urutan pelajaran yang dipublikasikan. Arahkan kursor ke nomor untuk melihat judulnya. Angka = nilai kuis terbaik.</p>
    </Card>
  );
}

