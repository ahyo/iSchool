'use client';
import { useState } from 'react';
import { CalendarClock, CheckCircle2, NotebookPen, Plus, Send, Trash2, Upload } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useLearningScope, type LearningScope } from '@/lib/useLearningScope';
import { Avatar, Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Textarea, run } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { addDays, avg, fmtDate, fmtDateTime, nowISO, round, today } from '@/lib/utils';
import type { Assignment, Submission } from '@/lib/types';

export default function TugasPage() {
  const scope = useLearningScope();
  if (!scope) return <Loading />;
  return scope.student ? <StudentTasks scope={scope} /> : <TeacherTasks scope={scope} />;
}

function StudentTasks({ scope }: { scope: LearningScope }) {
  const { data } = useData(['assignments', 'submissions']);
  const [tab, setTab] = useState<'aktif' | 'selesai'>('aktif');
  const [open, setOpen] = useState<Assignment | null>(null);
  const [content, setContent] = useState('');
  if (!data) return <Loading />;
  const st = scope.student!;
  const readOnly = scope.role === 'ortu';
  const mine = data.assignments.filter((a) => a.class_id === st.class_id);
  const subOf = (a: Assignment) => data.submissions.find((s) => s.assignment_id === a.id && s.student_id === st.id);
  const active = mine.filter((a) => !subOf(a) && a.due_date >= today()).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = mine.filter((a) => subOf(a) || a.due_date < today()).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const list = tab === 'aktif' ? active : done;
  const scored = mine.map(subOf).filter((s): s is Submission => !!s && s.score !== null);

  return (
    <>
      <PageHeader title="Tugas" subtitle={`${st.name} · rata-rata nilai tugas ${round(avg(scored.map((s) => s.score)), 1) ?? '-'}`} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'aktif', label: `Belum Dikerjakan (${active.length})` }, { value: 'selesai', label: `Riwayat (${done.length})` }]} />
      <div className="space-y-3">
        {list.map((a) => {
          const s = subOf(a);
          const late = s && s.submitted_at.slice(0, 10) > a.due_date;
          return (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600"><NotebookPen className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-slate-500">{scope.subjects.get(a.subject_id)?.name} · {scope.employees.get(a.teacher_id)?.name}</p>
                  <p className="mt-2 text-sm text-slate-700">{a.description}</p>
                  {s?.feedback && <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-800">Umpan balik guru: {s.feedback}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 text-sm">
                  <Badge tone={a.due_date < today() ? 'slate' : 'amber'}><CalendarClock className="mr-1 h-3 w-3" /> {fmtDate(a.due_date)}</Badge>
                  {s ? (
                    s.score !== null ? <span className="text-2xl font-bold text-emerald-600">{s.score}</span> : <Badge tone="blue">Terkumpul{late && ' (terlambat)'}</Badge>
                  ) : a.due_date < today() ? <Badge tone="red">Tidak mengumpulkan</Badge> : null}
                  {!readOnly && (!s || s.score === null) && (
                    <Button size="sm" onClick={() => { setOpen(a); setContent(s?.content || ''); }}><Upload className="h-4 w-4" /> {s ? 'Perbarui' : 'Kumpulkan'}</Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {!list.length && <Card><Empty text="Tidak ada tugas" /></Card>}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Kumpulkan: ${open?.title}`} footer={<Button onClick={() => run(async () => { await api.action('submissions.submit', { assignment_id: open!.id, student_id: st.id, content }); setOpen(null); }, 'Tugas berhasil dikumpulkan')}><Send className="h-4 w-4" /> Kirim</Button>}>
        <Field label="Jawaban / tautan dokumen"><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tulis jawaban atau tempel tautan Google Drive..." /></Field>
        <Field label="Lampiran" className="mt-3" hint="Mode demo: file tidak diunggah"><Input type="file" /></Field>
      </Modal>
    </>
  );
}

function TeacherTasks({ scope }: { scope: LearningScope }) {
  const { data } = useData(['assignments', 'submissions', 'grades', 'academic_years']);
  const [classId, setClassId] = useState('');
  const [edit, setEdit] = useState<Partial<Assignment> | null>(null);
  const [open, setOpen] = useState<Assignment | null>(null);
  const [scores, setScores] = useState<Record<number, { score: string; feedback: string }>>({});
  if (!data) return <Loading />;
  const { classList, subjects, classes, pairs, canManage } = scope;
  const rows = data.assignments.filter((a) => scope.pairAllowed(a.class_id, a.subject_id) && (!classId || a.class_id === Number(classId))).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const classStudents = (id: number) => scope.students.filter((s) => s.class_id === id && s.status === 'aktif').sort((a, b) => a.name.localeCompare(b.name));
  const subs = (a: Assignment) => data.submissions.filter((s) => s.assignment_id === a.id);
  const formClass = Number(edit?.class_id) || 0;
  const ay = data.academic_years.find((y) => y.is_active)!;

  const openGrading = (a: Assignment) => {
    setOpen(a);
    const m: Record<number, { score: string; feedback: string }> = {};
    subs(a).forEach((s) => (m[s.student_id] = { score: s.score?.toString() || '', feedback: s.feedback }));
    setScores(m);
  };

  const saveScores = () => run(async () => {
    for (const s of subs(open!)) {
      const v = scores[s.student_id];
      if (!v) continue;
      const score = v.score === '' ? null : Number(v.score);
      if (score !== s.score || v.feedback !== s.feedback) await api.update('submissions', s.id, { score, feedback: v.feedback });
    }
  }, 'Nilai tugas disimpan');

  const syncToGrades = (a: Assignment) => run(async () => {
    const related = data.assignments.filter((x) => x.class_id === a.class_id && x.subject_id === a.subject_id).map((x) => x.id);
    const rows = classStudents(a.class_id).map((st) => {
      const sc = data.submissions.filter((s) => related.includes(s.assignment_id) && s.student_id === st.id).map((s) => s.score);
      const existing = data.grades.find((g) => g.student_id === st.id && g.subject_id === a.subject_id && g.academic_year_id === ay.id);
      return { student_id: st.id, subject_id: a.subject_id, academic_year_id: ay.id, assignment: round(avg(sc), 0), daily: existing?.daily ?? null, midterm: existing?.midterm ?? null, final_exam: existing?.final_exam ?? null };
    });
    await api.action('grades.save', { rows });
  }, 'Rata-rata nilai tugas dikirim ke buku nilai');

  return (
    <>
      <PageHeader title="Tugas" subtitle="Buat tugas, pantau pengumpulan, dan beri nilai" actions={canManage && <Button onClick={() => setEdit({ class_id: Number(classId) || pairs[0]?.class_id, subject_id: pairs[0]?.subject_id, max_score: 100, due_date: addDays(today(), 7) })}><Plus className="h-4 w-4" /> Buat Tugas</Button>} />
      <div className="mb-4"><Select className="w-52" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Semua kelas" options={classList.map((c) => ({ value: c.id, label: c.name }))} /></div>
      <Card bodyClass="p-0">
        <div className="divide-y divide-slate-100">
          {rows.map((a) => {
            const total = classStudents(a.class_id).length;
            const s = subs(a);
            const graded = s.filter((x) => x.score !== null).length;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-slate-500">{subjects.get(a.subject_id)?.name} · {classes.get(a.class_id)?.name} · tenggat {fmtDate(a.due_date)}</p>
                </div>
                <div className="text-center text-sm"><p className="font-bold">{s.length}/{total}</p><p className="text-xs text-slate-500">terkumpul</p></div>
                <div className="text-center text-sm"><p className="font-bold">{graded}</p><p className="text-xs text-slate-500">dinilai</p></div>
                {a.due_date >= today() ? <Badge tone="amber">Aktif</Badge> : <Badge>Selesai</Badge>}
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => openGrading(a)}>Periksa & Nilai</Button>
                  {canManage && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus tugas?') && run(() => api.remove('assignments', a.id), 'Tugas dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              </div>
            );
          })}
        </div>
        {!rows.length && <Empty text="Belum ada tugas" />}
      </Card>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title="Buat Tugas" initial={edit || undefined}
        fields={[
          { name: 'class_id', label: 'Kelas', type: 'select', options: classList.map((c) => ({ value: c.id, label: c.name })), required: true },
          { name: 'subject_id', label: 'Mata Pelajaran', type: 'select', options: [...new Set(pairs.filter((p) => !formClass || p.class_id === formClass).map((p) => p.subject_id))].map((id) => ({ value: id, label: subjects.get(id)?.name || '' })), required: true },
          { name: 'title', label: 'Judul Tugas', required: true, full: true },
          { name: 'description', label: 'Instruksi', type: 'textarea' },
          { name: 'due_date', label: 'Tenggat', type: 'date', required: true },
          { name: 'max_score', label: 'Nilai Maksimal', type: 'number' },
        ]}
        onSubmit={(v) => run(async () => {
          const teacher_id = scope.employee?.id || (await api.list('schedules', { class_id: v.class_id, subject_id: v.subject_id }))[0]?.teacher_id || 0;
          await api.create('assignments', { ...v, teacher_id, created_at: nowISO(), description: v.description || '', max_score: v.max_score || 100 });
          setEdit(null);
        }, 'Tugas dibuat dan dibagikan ke siswa')} />

      <Modal open={!!open} onClose={() => setOpen(null)} title={`Penilaian: ${open?.title}`} size="xl" footer={<>
        <Button variant="secondary" onClick={() => open && syncToGrades(open)}><CheckCircle2 className="h-4 w-4" /> Kirim Rata-rata ke Buku Nilai</Button>
        <Button onClick={saveScores}>Simpan Nilai</Button>
      </>}>
        {open && (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Siswa</th><th>Pengumpulan</th><th>Jawaban</th><th className="w-24">Nilai</th><th className="w-56">Umpan Balik</th></tr></thead>
            <tbody>
              {classStudents(open.class_id).map((st) => {
                const s = subs(open).find((x) => x.student_id === st.id);
                return (
                  <tr key={st.id} className="border-b border-slate-100 align-top">
                    <td className="py-2"><span className="flex items-center gap-2"><Avatar name={st.name} className="h-7 w-7 text-[10px]" />{st.name}</span></td>
                    <td className="py-2 text-xs">{s ? <>{fmtDateTime(s.submitted_at)}{s.submitted_at.slice(0, 10) > open.due_date && <Badge tone="red" className="ml-1">Terlambat</Badge>}</> : <Badge tone="red">Belum</Badge>}</td>
                    <td className="max-w-xs py-2 text-xs text-slate-600">{s?.content || '-'}</td>
                    <td className="py-2">{s && <Input type="number" min={0} max={open.max_score} value={scores[st.id]?.score ?? ''} onChange={(e) => setScores({ ...scores, [st.id]: { ...scores[st.id], score: e.target.value } })} />}</td>
                    <td className="py-2">{s && <Input value={scores[st.id]?.feedback ?? ''} onChange={(e) => setScores({ ...scores, [st.id]: { ...scores[st.id], feedback: e.target.value } })} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Modal>
    </>
  );
}
