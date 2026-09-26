'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GraduationCap, LogOut, Menu, X, ShieldAlert, Globe } from 'lucide-react';
import { navFor, canAccess } from '@/lib/nav';
import { ROLE_LABEL, STAFF_ROLES, useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { useData, IS_DEMO } from '@/lib/api';
import { Avatar, Loading } from './ui';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { unitId, setUnitId, setChildId } = useWorkspace();
  const profile = useProfile();
  const { data } = useData(['units', 'classes', 'settings']);

  useEffect(() => {
    if (ready && !user) router.replace('/login/');
  }, [ready, user, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!ready || !user || !profile.loaded) return <Loading />;
  const groups = navFor(user.role);
  const allowed = canAccess(user.role, pathname);
  const isStaff = STAFF_ROLES.includes(user.role);
  const className = (id: number | null | undefined) => data?.classes.find((c) => c.id === id)?.name;

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar */}
      <aside className={cn('no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
          <div className="rounded-lg bg-brand-600 p-1.5 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white">iSchool</p>
            <p className="truncate text-[11px] text-slate-400">{data?.settings[0]?.foundation || 'Sistem Informasi Sekolah'}</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</p>
              {g.items.map((i) => {
                const active = pathname === i.href || pathname.startsWith(i.href + '/');
                return (
                  <Link key={i.href} href={i.href + '/'} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition', active ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 hover:text-white')}>
                    <i.icon className="h-4 w-4 shrink-0" />
                    {i.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-800 hover:text-white">
            <Globe className="h-4 w-4" /> Portal Sekolah
          </Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Topbar */}
      <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </button>
        {isStaff && data && (
          <select value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} className="max-w-[16rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <option value={0}>Semua Unit</option>
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        {user.role === 'ortu' && profile.children.length > 0 && (
          <select value={profile.student?.id} onChange={(e) => setChildId(Number(e.target.value))} className="max-w-[18rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            {profile.children.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({className(c.class_id) || '-'})</option>
            ))}
          </select>
        )}
        {user.role === 'siswa' && profile.student && <span className="hidden text-sm text-slate-500 sm:inline">Kelas {className(profile.student.class_id)} · NIS {profile.student.nis}</span>}
        {user.role === 'guru' && profile.employee && <span className="hidden text-sm text-slate-500 sm:inline">{data?.units.find((u) => u.id === profile.employee?.unit_id)?.name}</span>}
        <div className="ml-auto flex items-center gap-3">
          {IS_DEMO && <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline">MODE DEMO</span>}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
          <Avatar name={user.name} />
          <button
            onClick={() => {
              logout();
              router.replace('/login/');
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
            title="Keluar"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {allowed ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center text-slate-500">
            <ShieldAlert className="mb-3 h-10 w-10 text-red-400" />
            <p className="font-semibold text-slate-700">Akses ditolak</p>
            <p className="text-sm">Halaman ini tidak tersedia untuk peran {ROLE_LABEL[user.role]}.</p>
          </div>
        )}
      </main>
    </div>
  );
}
