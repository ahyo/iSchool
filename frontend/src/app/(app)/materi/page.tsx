'use client';
import { useState } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useLearningScope } from '@/lib/useLearningScope';
import { Badge, Button, Card, Empty, Loading, Modal, PageHeader, Select, run } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { fmtDate, nowISO } from '@/lib/utils';
import type { Material } from '@/lib/types';

export default function MateriPage() {
  const scope = useLearningScope();
  const { data } = useData(['materials']);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [edit, setEdit] = useState<Partial<Material> | null>(null);
  const [view, setView] = useState<Material | null>(null);
  if (!scope || !data) return <Loading />;
  const { pairs, classes, subjects, employees, isTeacher, classList } = scope;
  const canEdit = isTeacher || scope.role === 'admin';
  const rows = data.materials
    .filter((m) => scope.pairAllowed(m.class_id, m.subject_id))
    .filter((m) => (!classId || m.class_id === Number(classId)) && (!subjectId || m.subject_id === Number(subjectId)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const subjectOpts = [...new Set(pairs.filter((p) => !classId || p.class_id === Number(classId)).map((p) => p.subject_id))].map((id) => ({ value: id, label: subjects.get(id)?.name || '' }));
  const formClass = Number(edit?.class_id) || 0;

  return (
    <>
      <PageHeader title="Materi Pelajaran" subtitle={scope.student ? `Materi untuk kelas ${classes.get(scope.student.class_id || 0)?.name}` : 'Bahan ajar yang dibagikan guru ke kelas'} actions={canEdit && <Button onClick={() => setEdit({ class_id: Number(classId) || pairs[0]?.class_id, subject_id: Number(subjectId) || pairs[0]?.subject_id })}><Plus className="h-4 w-4" /> Unggah Materi</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {!scope.student && <Select className="w-48" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }} placeholder="Semua kelas" options={classList.map((c) => ({ value: c.id, label: c.name }))} />}
        <Select className="w-64" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder="Semua mata pelajaran" options={subjectOpts} />
      </div>
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{m.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><Badge tone="blue">{subjects.get(m.subject_id)?.name}</Badge><Badge>{classes.get(m.class_id)?.name}</Badge></div>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-slate-600">{m.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{employees.get(m.teacher_id)?.name.split(',')[0]} · {fmtDate(m.created_at)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setView(m)}>Buka</Button>
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => setEdit(m)}><Pencil className="h-4 w-4" /></Button>}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => confirm('Hapus materi?') && run(() => api.remove('materials', m.id), 'Materi dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty text="Belum ada materi" /></Card>}

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || ''} size="lg">
        {view && (
          <div className="text-sm">
            <div className="mb-3 flex flex-wrap gap-1"><Badge tone="blue">{subjects.get(view.subject_id)?.name}</Badge><Badge>{classes.get(view.class_id)?.name}</Badge><Badge>{employees.get(view.teacher_id)?.name}</Badge></div>
            <p className="mb-3 text-slate-600">{view.description}</p>
            <div className="whitespace-pre-line rounded-lg bg-slate-50 p-4 leading-relaxed text-slate-800">{view.content}</div>
            {view.link && <a href={view.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"><ExternalLink className="h-4 w-4" /> Buka tautan / file materi</a>}
          </div>
        )}
      </Modal>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Materi' : 'Unggah Materi'} initial={edit || undefined}
        fields={[
          { name: 'class_id', label: 'Kelas', type: 'select', options: classList.map((c) => ({ value: c.id, label: c.name })), required: true },
          { name: 'subject_id', label: 'Mata Pelajaran', type: 'select', options: [...new Set(pairs.filter((p) => !formClass || p.class_id === formClass).map((p) => p.subject_id))].map((id) => ({ value: id, label: subjects.get(id)?.name || '' })), required: true },
          { name: 'title', label: 'Judul', required: true, full: true },
          { name: 'description', label: 'Ringkasan', full: true },
          { name: 'content', label: 'Isi Materi', type: 'textarea' },
          { name: 'link', label: 'Tautan File/Video (Google Drive, YouTube, dll.)', full: true },
        ]}
        onSubmit={(v) => run(async () => {
          if (!scope.pairAllowed(v.class_id, v.subject_id) && scope.role === 'guru') throw new Error('Anda tidak mengajar mapel ini di kelas tersebut');
          const teacher_id = scope.employee?.id || (await api.list('schedules', { class_id: v.class_id, subject_id: v.subject_id }))[0]?.teacher_id || 0;
          if (v.id) await api.update('materials', v.id, v);
          else await api.create('materials', { ...v, teacher_id, created_at: nowISO(), description: v.description || '', content: v.content || '', link: v.link || '' });
          setEdit(null);
        }, 'Materi disimpan')} />
    </>
  );
}
