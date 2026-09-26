'use client';
import { useState } from 'react';
import { Plus, Trophy, UserMinus, UserPlus, Users } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Loading, Modal, PageHeader, Select, run } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy } from '@/lib/scope';
import type { Extracurricular } from '@/lib/types';

export default function EkskulPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { student } = useProfile();
  const { data } = useData(['extracurriculars', 'employees', 'students', 'units', 'classes']);
  const [edit, setEdit] = useState<Partial<Extracurricular> | null>(null);
  const [members, setMembers] = useState<Extracurricular | null>(null);
  const [add, setAdd] = useState('');
  if (!data) return <Loading />;
  const emp = indexBy(data.employees);
  const st = indexBy(data.students);
  const cls = indexBy(data.classes);
  const canEdit = user?.role === 'admin' || user?.role === 'kesiswaan';
  const effUnit = student?.unit_id || unitId;
  const list = data.extracurriculars.filter((e) => !effUnit || !e.unit_id || e.unit_id === effUnit);
  const cur = members ? data.extracurriculars.find((e) => e.id === members.id)! : null;

  const toggle = (e: Extracurricular, sid: number) => run(() => api.action('ekskul.toggle', { id: e.id, student_id: sid }), e.member_ids.includes(sid) ? 'Keluar dari ekskul' : 'Berhasil bergabung');

  return (
    <>
      <PageHeader title="Ekstrakurikuler" subtitle="Kegiatan pengembangan minat dan bakat siswa" actions={canEdit && <Button onClick={() => setEdit({ unit_id: unitId || null, member_ids: [] })}><Plus className="h-4 w-4" /> Tambah Ekskul</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => {
          const joined = student && e.member_ids.includes(student.id);
          return (
            <Card key={e.id}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600"><Trophy className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold">{e.name}</p>
                  <p className="text-sm text-slate-500">{e.schedule}</p>
                  <p className="text-sm">Pembina: {emp.get(e.coach_id || 0)?.name || '-'}</p>
                </div>
                <Badge tone="blue">{e.unit_id ? data.units.find((u) => u.id === e.unit_id)?.code : 'Semua unit'}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-slate-500"><Users className="h-4 w-4" /> {e.member_ids.length} anggota</span>
                {student && user?.role === 'siswa' ? (
                  <Button size="sm" variant={joined ? 'secondary' : 'primary'} onClick={() => toggle(e, student.id)}>{joined ? <><UserMinus className="h-4 w-4" /> Keluar</> : <><UserPlus className="h-4 w-4" /> Gabung</>}</Button>
                ) : student ? (joined ? <Badge tone="green">Anak Anda anggota</Badge> : null) : (
                  <Button size="sm" variant="secondary" onClick={() => setMembers(e)}>Anggota</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title="Ekstrakurikuler" initial={edit || undefined} size="md"
        fields={[
          { name: 'name', label: 'Nama Ekskul', required: true, full: true },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Semua unit' },
          { name: 'coach_id', label: 'Pembina', type: 'select', options: data.employees.filter((x) => x.type === 'guru').map((x) => ({ value: x.id, label: x.name })) },
          { name: 'schedule', label: 'Jadwal', full: true, placeholder: 'mis. Jumat, 14.00–16.00' },
        ]}
        onSubmit={(v) => run(async () => { await api.create('extracurriculars', { ...v, member_ids: [] }); setEdit(null); }, 'Ekskul ditambahkan')} />
      <Modal open={!!cur} onClose={() => setMembers(null)} title={`Anggota ${cur?.name || ''}`} size="lg">
        {cur && (
          <>
            {canEdit && (
              <div className="mb-4 flex gap-2">
                <Select className="flex-1" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="- Tambah siswa -" options={data.students.filter((s) => s.status === 'aktif' && !cur.member_ids.includes(s.id) && (!cur.unit_id || s.unit_id === cur.unit_id)).map((s) => ({ value: s.id, label: `${s.name} — ${cls.get(s.class_id || 0)?.name}` }))} />
                <Button disabled={!add} onClick={() => { toggle(cur, Number(add)); setAdd(''); }}>Tambah</Button>
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {cur.member_ids.map((id) => st.get(id)).filter(Boolean).map((s) => (
                <li key={s!.id} className="flex items-center gap-3 py-2 text-sm">
                  <Avatar name={s!.name} className="h-7 w-7 text-[10px]" />
                  <span className="flex-1">{s!.name} <span className="text-slate-500">· {cls.get(s!.class_id || 0)?.name}</span></span>
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => toggle(cur, s!.id)}><UserMinus className="h-4 w-4 text-red-500" /></Button>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </>
  );
}
