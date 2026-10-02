'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, Crown, Wallet, Users, Presentation, BookOpenCheck, Heart, ArrowLeft, Library } from 'lucide-react';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { IS_DEMO } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';
import type { Role } from '@/lib/types';
import { BRAND } from '@/lib/brand';

const DEMO: { role: Role; username: string; icon: React.ElementType; desc: string }[] = [
  { role: 'admin', username: 'admin', icon: ShieldCheck, desc: 'Akses penuh semua modul' },
  { role: 'kepsek', username: 'kepsek', icon: Crown, desc: 'Monitoring & persetujuan' },
  { role: 'keuangan', username: 'keuangan', icon: Wallet, desc: 'Tagihan, pembayaran, laporan' },
  { role: 'kesiswaan', username: 'kesiswaan', icon: Users, desc: 'PPDB, siswa, kedisiplinan' },
  { role: 'pustakawan', username: 'pustakawan', icon: Library, desc: 'Katalog, sirkulasi, denda' },
  { role: 'guru', username: 'guru', icon: Presentation, desc: 'Presensi, materi, tugas, nilai' },
  { role: 'siswa', username: 'siswa', icon: BookOpenCheck, desc: 'Belajar, ujian CBT, tagihan' },
  { role: 'ortu', username: 'ortu', icon: Heart, desc: 'Pantau 2 anak (SMA & SMP)' },
];

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard/');
  }, [ready, user, router]);

  const doLogin = async (u: string, p: string) => {
    setBusy(true);
    setError('');
    try {
      await login(u, p);
      router.replace('/dashboard/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <Link href="/" className="relative flex items-center gap-2 font-bold">
          <GraduationCap className="h-7 w-7" /> {BRAND.short}
        </Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Sistem Informasi {BRAND.name}</h1>
          <p className="mt-4 max-w-md text-brand-100">PPDB online, keuangan, presensi, pembelajaran daring & ujian CBT, rapor, hingga kelulusan dalam satu platform.</p>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} {BRAND.name} · {BRAND.region}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Kembali ke portal
          </Link>
          <h2 className="text-2xl font-bold text-slate-900">Masuk ke Sistem Sekolah</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh sekolah.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(username, password);
            }}
          >
            <Field label="Username / NIS">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>Masuk</Button>
          </form>

          {IS_DEMO && (
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-slate-700">Akun demo — klik untuk masuk langsung</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO.map((d) => (
                  <button
                    key={d.role}
                    onClick={() => doLogin(d.username, 'demo123')}
                    disabled={busy}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:bg-brand-50"
                  >
                    <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{ROLE_LABEL[d.role]}</span>
                      <span className="block text-xs text-slate-500">{d.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Username sesuai peran (mis. <code>admin</code>, <code>guru</code>), password <code>demo123</code>. Data demo tersimpan di browser Anda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
