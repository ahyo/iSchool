'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, GraduationCap, MapPin, School, Users, Award, Newspaper } from 'lucide-react';
import { useAction } from '@/lib/api';
import { PublicFooter, PublicNav } from '@/components/PublicNav';
import { Badge, Loading, Modal } from '@/components/ui';
import { fmtDate, rupiah } from '@/lib/utils';
import type { Announcement, EventItem, FeeType, Major, Settings, Unit } from '@/lib/types';

interface Portal {
  settings: Settings;
  units: Unit[];
  majors: Major[];
  announcements: Announcement[];
  events: EventItem[];
  fee_types: FeeType[];
  stats: { students: number; teachers: number; classes: number; alumni: number };
}

export default function PortalPage() {
  const { data } = useAction<Portal>('public.portal');
  const [news, setNews] = useState<Announcement | null>(null);
  if (!data) return (<><PublicNav /><Loading /></>);
  const s = data.settings;
  const unit = data.units[0];
  const hasStats = data.stats.students > 0 || data.stats.teachers > 0;

  return (
    <div className="bg-white">
      <PublicNav />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white">
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            {s.ppdb_open && <Badge className="mb-4 bg-white/15 text-white">PPDB 2027/2028 telah dibuka</Badge>}
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{s.name}</h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">{s.vision}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ppdb/" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 hover:bg-brand-50">
                Daftar Sekarang <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login/" className="rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10">Masuk ke iSchool</Link>
            </div>
          </div>
          {hasStats ? <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: 'Siswa Aktif', value: data.stats.students },
              { icon: GraduationCap, label: 'Guru Profesional', value: data.stats.teachers },
              { icon: School, label: 'Rombongan Belajar', value: data.stats.classes },
              { icon: Award, label: 'Alumni', value: data.stats.alumni.toLocaleString('id-ID') },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <x.icon className="h-6 w-6 text-brand-200" />
                <p className="mt-3 text-3xl font-bold">{x.value}</p>
                <p className="text-sm text-brand-100">{x.label}</p>
              </div>
            ))}
          </div> : unit && (
            <div className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <School className="h-8 w-8 text-brand-200" />
              <p className="mt-3 text-2xl font-bold">{unit.name}</p>
              <p className="mt-1 text-brand-100">Kelas {unit.min_grade}–{unit.max_grade}{unit.accreditation && ` · Akreditasi ${unit.accreditation}`}{unit.npsn && ` · NPSN ${unit.npsn}`}</p>
              {s.address && <p className="mt-3 flex items-start gap-2 text-sm text-brand-100"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {s.address}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Profil */}
      <section id="profil" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Profil Sekolah</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{s.name}</h2>
            <p className="mt-4 text-slate-600">Seluruh layanan sekolah — mulai dari pendaftaran, pembayaran, presensi, pembelajaran, ujian, hingga rapor — terintegrasi secara digital sehingga orang tua dapat memantau perkembangan anak kapan saja.</p>
            {unit && <p className="mt-3 text-sm text-slate-500">Jenjang SMP · Kelas {unit.min_grade}–{unit.max_grade}{unit.npsn && ` · NPSN ${unit.npsn}`}{unit.accreditation && ` · Akreditasi ${unit.accreditation}`}</p>}
            {s.vision && <div className="mt-6 rounded-xl bg-brand-50 p-5">
              <p className="font-semibold text-brand-900">Visi</p>
              <p className="mt-1 text-slate-700">{s.vision}</p>
            </div>}
          </div>
          {s.mission.trim() && <div>
            <p className="mb-3 font-semibold text-slate-900">Misi</p>
            <ul className="space-y-3">
              {s.mission.split('\n').filter(Boolean).map((m) => (
                <li key={m} className="flex gap-3 rounded-lg border border-slate-200 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <span className="text-slate-700">{m}</span>
                </li>
              ))}
            </ul>
          </div>}
        </div>
      </section>

      {/* Berita */}
      {data.announcements.length > 0 && <section id="berita" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Kabar Sekolah</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Berita & Pengumuman</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.announcements.map((a) => (
            <button key={a.id} onClick={() => setNews(a)} className="group rounded-2xl border border-slate-200 p-6 text-left transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Newspaper className="h-4 w-4" />
                <Badge tone="blue">{a.category}</Badge>
                <span>{fmtDate(a.published_at)}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-brand-700">{a.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.content}</p>
            </button>
          ))}
        </div>
      </section>}

      {/* Agenda */}
      {data.events.length > 0 && <section id="agenda" className="scroll-mt-16 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Kalender</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Agenda Mendatang</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {data.events.map((e) => (
              <div key={e.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
                  <span className="text-xl font-bold leading-none">{new Date(e.date + 'T00:00:00').getDate()}</span>
                  <span className="text-xs">{fmtDate(e.date, { month: 'short' })}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{e.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><CalendarDays className="h-4 w-4" /> {fmtDate(e.date)}{e.end_date && ` – ${fmtDate(e.end_date)}`}</p>
                  <p className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {e.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-brand-600 to-brand-800 p-10 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Bergabunglah bersama kami</h2>
            <p className="mt-2 max-w-xl text-brand-100">Pendaftaran siswa baru dan siswa pindahan dapat dilakukan secara online. Pantau status pendaftaran dan lakukan pembayaran langsung dari portal.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/ppdb/" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700"><BookOpen className="h-4 w-4" /> Daftar Online</Link>
            <Link href="/ppdb/?tab=status" className="rounded-lg border border-white/40 px-5 py-3 font-semibold">Cek Status</Link>
          </div>
        </div>
      </section>

      <PublicFooter name={s.name} address={s.address} phone={s.phone} email={s.email} />

      <Modal open={!!news} onClose={() => setNews(null)} title={news?.title || ''}>
        {news && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
              <Badge tone="blue">{news.category}</Badge> {fmtDate(news.published_at)} · {news.author}
            </div>
            <p className="whitespace-pre-line text-slate-700">{news.content}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
