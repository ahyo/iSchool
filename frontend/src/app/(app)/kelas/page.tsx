'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Loading, Modal, PageHeader, ProgressBar, run, StatusBadge } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { indexBy, sortClasses } from '@/lib/scope';
import { gradeLabel } from '@/lib/utils';
import type { SchoolClass } from '@/lib/types';

export default function KelasPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['classes', 'units', 'employees', 'students', 'majors', 'academic_years']);
  const [edit, setEdit] = useState<Partial<SchoolClass> | null>(null);
  const [view, setView] = useState<SchoolClass | null>(null);
  if (!data) return <Loading />;
  const canEdit = user?.role === 'admin';
  const emp = indexBy(data.employees);
  const majors = indexBy(data.majors);
  const units = data.units.filter((u) => !unitId || u.id === unitId);
  const members = (id: number) => data.students.filter((s) => s.class_id === id && s.status === 'aktif');
  const activeYear = data.academic_years.find((y) => y.is_active);

  const editUnit = data.units.find((u) => u.id === Number(edit?.unit_id));
  const fields = [
    { name: 'unit_id', label: 'Unit', type: 'select' as const, options: data.units.map((u) => ({ value: u.id, label: u.name })), required: true },
    { name: 'grade', label: 'Tingkat', type: 'select' as const, options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Kelas ${gradeLabel(i + 1)}` })), required: true },
    { name: 'name', label: 'Nama Rombel', required: true, placeholder: 'mis. X-3 / XI TKJ 2' },
    { name: 'major_id', label: 'Jurusan / Peminatan', type: 'select' as const, options: data.majors.map((m) => ({ value: m.id, label: `${m.code} - ${m.name}` })), placeholder: '- Tidak ada -' },
    { name: 'homeroom_id', label: 'Wali Kelas', type: 'select' as const, options: data.employees.filter((e) => e.type === 'guru' && (!editUnit || e.unit_id === editUnit.id)).map((e) => ({ value: e.id, label: e.name })) },
    { name: 'room', label: 'Ruang' },
    { name: 'capacity', label: 'Kapasitas', type: 'number' as const },
  ];

  return (
    <>
      <PageHeader title="Kelas & Rombongan Belajar" subtitle={`Tahun ajaran ${activeYear?.name} semester ${activeYear?.semester}`} actions={canEdit && <Button onClick={() => setEdit({ unit_id: unitId || undefined, capacity: 32, academic_year_id: activeYear?.id })}><Plus className="h-4 w-4" /> Tambah Kelas</Button>} />
      <div className="space-y-6">
        {units.map((u) => (
          <Card key={u.id} title={<span>{u.name} <span className="font-normal text-slate-500">· Kelas {u.min_grade}–{u.max_grade}</span></span>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.classes.filter((c) => c.unit_id === u.id).sort(sortClasses).map((c) => {
                const n = members(c.id).length;
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold">{c.name}</p>
                        <p className="text-xs text-slate-500">Tingkat {gradeLabel(c.grade)} · {c.room}{c.major_id && ` · ${majors.get(c.major_id)?.code}`}</p>
                      </div>
                      {canEdit && (
                        <div className="flex">
                          <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (n) return run(async () => { throw new Error('Kelas masih memiliki siswa'); }); if (confirm(`Hapus kelas ${c.name}?`)) run(() => api.remove('classes', c.id), 'Kelas dihapus'); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm">Wali kelas: <b>{emp.get(c.homeroom_id || 0)?.name || '-'}</b></p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <ProgressBar value={(n / c.capacity) * 100} />
                      <span className="whitespace-nowrap">{n}/{c.capacity}</span>
                    </div>
                    <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setView(c)}><Users className="h-4 w-4" /> Lihat Siswa</Button>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Kelas' : 'Tambah Kelas'} fields={fields} initial={edit || undefined}
        onSubmit={(v) => run(async () => {
          if (v.id) await api.update('classes', v.id, v);
          else await api.create('classes', { ...v, academic_year_id: activeYear?.id || 1, room: v.room || '', capacity: v.capacity || 32 });
          setEdit(null);
        }, 'Kelas disimpan')} />

      <Modal open={!!view} onClose={() => setView(null)} title={`Daftar Siswa ${view?.name || ''}`} size="lg">
        {view && (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">No</th><th>NIS</th><th>Nama</th><th>L/P</th><th>Status</th></tr></thead>
            <tbody>
              {members(view.id).sort((a, b) => a.name.localeCompare(b.name)).map((s, i) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2">{i + 1}</td><td className="font-mono text-xs">{s.nis}</td>
                  <td><span className="flex items-center gap-2"><Avatar name={s.name} className="h-6 w-6 text-[9px]" />{s.name}</span></td>
                  <td>{s.gender}</td><td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view && <p className="mt-3 text-sm text-slate-500"><Badge tone="blue">{members(view.id).filter((s) => s.gender === 'L').length} L</Badge> <Badge tone="violet">{members(view.id).filter((s) => s.gender === 'P').length} P</Badge></p>}
      </Modal>
    </>
  );
}
