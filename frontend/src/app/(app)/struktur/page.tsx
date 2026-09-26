'use client';
import { useState } from 'react';
import { useData } from '@/lib/api';
import { useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Card, Loading, PageHeader } from '@/components/ui';
import { indexBy } from '@/lib/scope';
import type { Employee } from '@/lib/types';
import { cn } from '@/lib/utils';

function Node({ e, children, unitCode }: { e: Employee; children?: React.ReactNode; unitCode?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn('w-52 rounded-xl border bg-white p-3 text-center shadow-sm', e.type === 'pimpinan' ? 'border-brand-300' : 'border-slate-200')}>
        <Avatar name={e.name} className="mx-auto mb-2 h-10 w-10" />
        <p className="text-sm font-semibold leading-tight">{e.name}</p>
        <p className="mt-0.5 text-xs text-brand-700">{e.position}</p>
        {unitCode && <Badge tone="blue" className="mt-1">{unitCode}</Badge>}
      </div>
      {children}
    </div>
  );
}

export default function StrukturPage() {
  const { unitId } = useWorkspace();
  const { data } = useData(['employees', 'units', 'classes']);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const active = data.employees.filter((e) => e.is_active);
  const childrenOf = (id: number) => active.filter((e) => e.supervisor_id === id);
  const homeroom = (id: number) => data.classes.find((c) => c.homeroom_id === id)?.name;

  const render = (e: Employee, depth = 0): React.ReactNode => {
    let kids = childrenOf(e.id);
    if (depth === 0 && unitId) kids = kids.filter((k) => k.unit_id === unitId || k.unit_id === null);
    const leaders = kids.filter((k) => k.type !== 'guru');
    const teachers = kids.filter((k) => k.type === 'guru');
    return (
      <Node key={e.id} e={e} unitCode={e.unit_id && depth <= 1 ? units.get(e.unit_id)?.code : undefined}>
        {(leaders.length > 0 || teachers.length > 0) && (
          <>
            <div className="h-5 w-px bg-slate-300" />
            <div className="relative flex flex-wrap justify-center gap-4 border-t border-slate-300 pt-5">
              {leaders.map((k) => render(k, depth + 1))}
              {teachers.length > 0 && (
                <div className="w-56 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3">
                  <button className="w-full text-left" onClick={() => setExpanded((x) => ({ ...x, [e.id]: !x[e.id] }))}>
                    <p className="text-sm font-semibold text-emerald-800">Dewan Guru ({teachers.length})</p>
                    <p className="text-xs text-emerald-700">{expanded[e.id] ? 'Sembunyikan' : 'Tampilkan daftar guru'}</p>
                  </button>
                  {expanded[e.id] && (
                    <ul className="mt-2 space-y-1.5">
                      {teachers.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-xs">
                          <Avatar name={t.name} className="h-6 w-6 text-[9px]" />
                          <span>{t.name}{homeroom(t.id) && <span className="text-slate-500"> · Wali {homeroom(t.id)}</span>}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Node>
    );
  };

  const roots = active.filter((e) => !e.supervisor_id);
  return (
    <>
      <PageHeader title="Struktur Organisasi" subtitle="Hierarki kepemimpinan yayasan dan unit sekolah (klik Dewan Guru untuk melihat anggota)" />
      <Card bodyClass="overflow-x-auto p-6">
        <div className="flex min-w-max justify-center">{roots.map((r) => render(r))}</div>
      </Card>
    </>
  );
}
