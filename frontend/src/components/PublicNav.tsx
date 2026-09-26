'use client';
import Link from 'next/link';
import { useState } from 'react';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const LINKS = [
  { href: '/#profil', label: 'Profil' },
  { href: '/#jenjang', label: 'Jenjang' },
  { href: '/#berita', label: 'Berita' },
  { href: '/#agenda', label: 'Agenda' },
  { href: '/ppdb/', label: 'PPDB' },
  { href: '/#kontak', label: 'Kontak' },
];

export function PublicNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="rounded-lg bg-brand-600 p-1.5 text-white"><GraduationCap className="h-5 w-5" /></span>
          <span>Nusantara Cendekia</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-600">{l.label}</Link>
          ))}
        </nav>
        <Link href={user ? '/dashboard/' : '/login/'} className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 md:ml-0">
          {user ? 'Dashboard' : 'Masuk'}
        </Link>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col border-t border-slate-100 px-4 py-2 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2 text-sm font-medium text-slate-700">{l.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function PublicFooter({ name, address, phone, email }: { name?: string; address?: string; phone?: string; email?: string }) {
  return (
    <footer id="kontak" className="bg-slate-900 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-bold text-white"><GraduationCap className="h-5 w-5" /> {name || 'Nusantara Cendekia'}</p>
          <p className="mt-3 text-sm">Lembaga pendidikan terpadu jenjang SD, SMP, SMA, dan SMK.</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Kontak</p>
          <p>{address}</p>
          <p className="mt-1">Telp: {phone}</p>
          <p>Email: {email}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Tautan</p>
          <ul className="space-y-1">
            <li><Link href="/ppdb/" className="hover:text-white">Pendaftaran Siswa Baru</Link></li>
            <li><Link href="/ppdb/?tab=status" className="hover:text-white">Cek Status Pendaftaran</Link></li>
            <li><Link href="/login/" className="hover:text-white">Login Siswa, Orang Tua & Guru</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs">© {new Date().getFullYear()} {name}. Dibangun dengan iSchool.</div>
    </footer>
  );
}
