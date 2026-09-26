'use client';
import { useState } from 'react';
import { CalendarDays, Globe, MapPin, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Badge, Button, Card, Empty, Loading, PageHeader, Tabs, run } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { fmtDate, nowISO, today } from '@/lib/utils';
import type { Announcement, EventItem, Role } from '@/lib/types';

const AUDIENCE_FOR: Record<Role, Announcement['audience'][]> = {
  admin: ['semua', 'siswa', 'ortu', 'guru', 'staf'], kepsek: ['semua', 'siswa', 'ortu', 'guru', 'staf'], keuangan: ['semua', 'staf', 'ortu'], kesiswaan: ['semua', 'staf', 'siswa', 'ortu'],
  guru: ['semua', 'guru', 'siswa'], siswa: ['semua', 'siswa'], ortu: ['semua', 'ortu'],
};

export default function PengumumanPage() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { student } = useProfile();
  const { data } = useData(['announcements', 'events', 'units']);
  const [tab, setTab] = useState<'pengumuman' | 'agenda'>('pengumuman');
  const [edit, setEdit] = useState<Partial<Announcement> | null>(null);
  const [editEv, setEditEv] = useState<Partial<EventItem> | null>(null);
  if (!data || !user) return <Loading />;
  const canEdit = ['admin', 'kepsek', 'kesiswaan', 'keuangan'].includes(user.role);
  const effUnit = student?.unit_id || unitId;
  const list = data.announcements.filter((a) => AUDIENCE_FOR[user.role].includes(a.audience) && (!effUnit || !a.unit_id || a.unit_id === effUnit)).sort((a, b) => b.published_at.localeCompare(a.published_at));
  const events = data.events.filter((e) => !effUnit || !e.unit_id || e.unit_id === effUnit).sort((a, b) => a.date.localeCompare(b.date));
  const unitName = (id: number | null) => (id ? data.units.find((u) => u.id === id)?.code : 'Semua unit');

  return (
    <>
      <PageHeader title="Pengumuman & Agenda" subtitle="Informasi resmi sekolah untuk siswa, orang tua, guru, dan staf" actions={canEdit && (tab === 'pengumuman'
        ? <Button onClick={() => setEdit({ category: 'Umum', audience: 'semua', is_public: false, unit_id: unitId || null })}><Plus className="h-4 w-4" /> Buat Pengumuman</Button>
        : <Button onClick={() => setEditEv({ date: today(), unit_id: unitId || null })}><Plus className="h-4 w-4" /> Tambah Agenda</Button>)} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pengumuman', label: `Pengumuman (${list.length})` }, { value: 'agenda', label: 'Kalender Agenda' }]} />
      {tab === 'pengumuman' ? (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600"><Megaphone className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{a.category}</Badge>
                    <Badge>Untuk: {a.audience}</Badge>
                    <Badge tone="violet">{unitName(a.unit_id)}</Badge>
                    {a.is_public && <Badge tone="green"><Globe className="mr-1 h-3 w-3" />Tampil di portal</Badge>}
                  </div>
                  <p className="mt-2 font-semibold">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{a.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{a.author} · {fmtDate(a.published_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                {canEdit && (
                  <div className="flex">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm('Hapus pengumuman?') && run(() => api.remove('announcements', a.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {!list.length && <Card><Empty /></Card>}
        </div>
      ) : (
        <Card bodyClass="p-0">
          <div className="divide-y divide-slate-100">
            {events.map((e) => (
              <div key={e.id} className={`flex items-center gap-4 px-4 py-3 ${e.date < today() ? 'opacity-50' : ''}`}>
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
                  <span className="text-lg font-bold leading-none">{new Date(e.date + 'T00:00:00').getDate()}</span>
                  <span className="text-[10px]">{fmtDate(e.date, { month: 'short', year: '2-digit' })}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="flex flex-wrap items-center gap-3 text-sm text-slate-500"><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtDate(e.date)}{e.end_date && ` – ${fmtDate(e.end_date)}`}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{e.location}</span></p>
                  {e.description && <p className="text-sm text-slate-600">{e.description}</p>}
                </div>
                <Badge tone="violet">{unitName(e.unit_id)}</Badge>
                {canEdit && <div className="flex"><Button size="sm" variant="ghost" onClick={() => setEditEv(e)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => confirm('Hapus agenda?') && run(() => api.remove('events', e.id), 'Dihapus')}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>}
              </div>
            ))}
          </div>
          {!events.length && <Empty />}
        </Card>
      )}
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Pengumuman' : 'Buat Pengumuman'} initial={edit || undefined}
        fields={[
          { name: 'title', label: 'Judul', required: true, full: true },
          { name: 'category', label: 'Kategori', type: 'select', options: ['Umum', 'Akademik', 'Keuangan', 'Kesiswaan', 'PPDB'].map((x) => ({ value: x, label: x })) },
          { name: 'audience', label: 'Ditujukan untuk', type: 'select', options: [{ value: 'semua', label: 'Semua' }, { value: 'siswa', label: 'Siswa' }, { value: 'ortu', label: 'Orang tua' }, { value: 'guru', label: 'Guru' }, { value: 'staf', label: 'Staf' }] },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Semua unit' },
          { name: 'is_public', label: 'Tampilkan di portal publik', type: 'checkbox' },
          { name: 'content', label: 'Isi Pengumuman', type: 'textarea' },
        ]}
        onSubmit={(v) => run(async () => { if (v.id) await api.update('announcements', v.id, v); else await api.create('announcements', { ...v, content: v.content || '', author: user.name, published_at: nowISO() }); setEdit(null); }, 'Pengumuman disimpan')} />
      <FormModal open={!!editEv} onClose={() => setEditEv(null)} title="Agenda" initial={editEv || undefined} size="md"
        fields={[
          { name: 'title', label: 'Nama Kegiatan', required: true, full: true },
          { name: 'date', label: 'Tanggal Mulai', type: 'date', required: true },
          { name: 'end_date', label: 'Tanggal Selesai', type: 'date' },
          { name: 'location', label: 'Lokasi' },
          { name: 'unit_id', label: 'Unit', type: 'select', options: data.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Semua unit' },
          { name: 'description', label: 'Keterangan', type: 'textarea' },
        ]}
        onSubmit={(v) => run(async () => { const p = { ...v, end_date: v.end_date || null, location: v.location || '', description: v.description || '' }; if (v.id) await api.update('events', v.id, p); else await api.create('events', p); setEditEv(null); }, 'Agenda disimpan')} />
    </>
  );
}
