'use client';
import { useEffect, useState } from 'react';
import { Plus, Printer, X } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Button, Card, Loading, PageHeader, Select, run } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy, sortClasses } from '@/lib/scope';
import { DAYS, cn } from '@/lib/utils';
import type { Schedule } from '@/lib/types';

const COLORS = ['bg-blue-50 border-blue-200 text-blue-900', 'bg-emerald-50 border-emerald-200 text-emerald-900', 'bg-amber-50 border-amber-200 text-amber-900', 'bg-violet-50 border-violet-200 text-violet-900', 'bg-rose-50 border-rose-200 text-rose-900', 'bg-cyan-50 border-cyan-200 text-cyan-900'];

export default function JadwalPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { employee, student } = useProfile();
  const { data } = useData(['schedules', 'classes', 'subjects', 'employees']);
  const [mode, setMode] = useState<'class' | 'teacher'>('class');
  const [classId, setClassId] = useState<number>(0);
  const [teacherId, setTeacherId] = useState<number>(0);
  const [add, setAdd] = useState<Partial<Schedule> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (student?.class_id) setClassId(student.class_id);
    else if (user?.role === 'guru' && employee) { setMode('teacher'); setTeacherId(employee.id); }
    else if (!classId) setClassId(data.classes.filter((c) => !unitId || c.unit_id === unitId).sort(sortClasses)[0]?.id || 0);
  }, [data, student, employee, user, unitId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Loading />;
  const cls = indexBy(data.classes);
  const sub = indexBy(data.subjects);
  const emp = indexBy(data.employees);
  const isStaff = ['admin', 'kepsek', 'guru'].includes(user?.role || '');
  const canEdit = user?.role === 'admin';
  const entries = data.schedules.filter((s) => (mode === 'class' ? s.class_id === classId : s.teacher_id === teacherId));
  const slots = [...new Set(entries.map((e) => `${e.start_time}-${e.end_time}`))].sort();
  const allSlots = slots.length ? slots : ['07:30-08:50', '08:50-10:10', '10:30-11:50', '12:30-13:50'];
  const subjectColor = (id: number) => COLORS[id % COLORS.length];
  const curClass = cls.get(classId);
  const classes = data.classes.filter((c) => !unitId || c.unit_id === unitId || user?.role === 'guru').sort(sortClasses);
  const teachers = data.employees.filter((e) => e.type === 'guru' && (!unitId || e.unit_id === unitId));

  return (
    <>
      <PageHeader
        title="Jadwal Pelajaran"
        subtitle={mode === 'class' ? `Kelas ${curClass?.name || '-'} · Wali kelas ${emp.get(curClass?.homeroom_id || 0)?.name || '-'}` : `Jadwal mengajar ${emp.get(teacherId)?.name || ''}`}
        actions={<Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak</Button>}
      />
      {isStaff && (
        <div className="no-print mb-4 flex flex-wrap gap-2">
          <Select className="w-44" value={mode} onChange={(e) => setMode(e.target.value as 'class')} options={[{ value: 'class', label: 'Per Kelas' }, { value: 'teacher', label: 'Per Guru' }]} />
          {mode === 'class' ? (
            <Select className="w-52" value={classId} onChange={(e) => setClassId(Number(e.target.value))} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          ) : (
            <Select className="w-72" value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} placeholder="- Pilih guru -" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
          )}
          {canEdit && mode === 'class' && <Button onClick={() => setAdd({ class_id: classId, day: 1, start_time: '07:30', end_time: '08:50' })}><Plus className="h-4 w-4" /> Tambah Jam</Button>}
        </div>
      )}
      <Card bodyClass="p-0 overflow-x-auto" className="print-area">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="w-28 border-b border-slate-200 px-3 py-2 text-left">Jam</th>
              {[1, 2, 3, 4, 5].map((d) => <th key={d} className="border-b border-l border-slate-200 px-3 py-2 text-left">{DAYS[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {allSlots.map((slot) => {
              const [st] = slot.split('-');
              return (
                <tr key={slot}>
                  <td className="border-b border-slate-100 px-3 py-2 font-mono text-xs text-slate-500">{slot.replace('-', '–')}</td>
                  {[1, 2, 3, 4, 5].map((d) => {
                    const items = entries.filter((e) => e.day === d && e.start_time === st);
                    return (
                      <td key={d} className="h-20 border-b border-l border-slate-100 p-1.5 align-top">
                        {items.map((e) => (
                          <div key={e.id} className={cn('group relative mb-1 rounded-md border px-2 py-1.5', subjectColor(e.subject_id))}>
                            <p className="text-xs font-semibold leading-tight">{sub.get(e.subject_id)?.name}</p>
                            <p className="mt-0.5 text-[11px] opacity-75">{mode === 'class' ? emp.get(e.teacher_id)?.name.split(',')[0] : cls.get(e.class_id)?.name}</p>
                            {canEdit && <button onClick={() => confirm('Hapus jam pelajaran ini?') && run(() => api.remove('schedules', e.id), 'Dihapus')} className="absolute right-1 top-1 hidden rounded p-0.5 hover:bg-white/60 group-hover:block"><X className="h-3 w-3" /></button>}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="no-print mt-3 text-xs text-slate-500">Istirahat: 10.10–10.30 dan 11.50–12.30. Satu blok = 2 JP.</p>

      <FormModal open={!!add} onClose={() => setAdd(null)} title="Tambah Jam Pelajaran" initial={add || undefined} size="md"
        fields={[
          { name: 'day', label: 'Hari', type: 'select', options: [1, 2, 3, 4, 5].map((d) => ({ value: d, label: DAYS[d] })), required: true },
          { name: 'subject_id', label: 'Mata Pelajaran', type: 'select', options: data.subjects.filter((s) => s.unit_id === curClass?.unit_id).map((s) => ({ value: s.id, label: s.name })), required: true },
          { name: 'start_time', label: 'Mulai', type: 'time', required: true },
          { name: 'end_time', label: 'Selesai', type: 'time', required: true },
          { name: 'teacher_id', label: 'Guru', type: 'select', options: data.employees.filter((e) => e.type === 'guru' && e.unit_id === curClass?.unit_id).map((e) => ({ value: e.id, label: e.name })), required: true, full: true },
        ]}
        onSubmit={(v) => run(async () => {
          const clash = data.schedules.find((s) => s.teacher_id === v.teacher_id && s.day === v.day && s.start_time === v.start_time);
          if (clash) throw new Error(`Bentrok: guru sudah mengajar di ${cls.get(clash.class_id)?.name} pada jam tersebut`);
          await api.create('schedules', { ...v, class_id: classId });
          setAdd(null);
        }, 'Jadwal ditambahkan')} />
    </>
  );
}
