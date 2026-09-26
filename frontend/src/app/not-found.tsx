import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <p className="text-slate-600">Halaman tidak ditemukan.</p>
      <Link href="/" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Kembali ke Portal</Link>
    </div>
  );
}
