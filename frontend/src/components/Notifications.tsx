'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useData } from '@/lib/api';
import { useAuth, useProfile } from '@/lib/auth';
import type { DB, Resource, Role } from '@/lib/types';
import { addDays, cn, fmtDate, isWeekend, rupiah, today } from '@/lib/utils';

interface Notif {
  id: string;
  title: string;
  desc: string;
  href: string;
  tone: 'red' | 'amber' | 'blue' | 'green';
}

/** Koleksi yang dibutuhkan per peran (hanya memuat data yang relevan). */
const KEYS: Record<Role, Resource[]> = {
  siswa: ['bills', 'assignments', 'submissions', 'exams', 'exam_results', 'virtual_classes', 'announcements', 'leave_requests'],
  ortu: ['bills', 'assignments', 'submissions', 'exams', 'exam_results', 'virtual_classes', 'announcements', 'leave_requests'],
  guru: ['classes', 'student_attendance', 'schedules', 'teaching_journals', 'assignments', 'submissions', 'leave_requests', 'students', 'virtual_classes', 'announcements'],
  keuangan: ['bills', 'payments', 'announcements'],
  kesiswaan: ['applicants', 'leave_requests', 'announcements'],
  kepsek: ['applicants', 'leave_requests', 'bills', 'announcements'],
  admin: ['applicants', 'leave_requests', 'bills', 'announcements'],
};

const AUDIENCE: Record<Role, string[]> = {
  admin: ['semua', 'staf', 'guru'], kepsek: ['semua', 'staf', 'guru'], keuangan: ['semua', 'staf'], kesiswaan: ['semua', 'staf'],
  guru: ['semua', 'guru'], siswa: ['semua', 'siswa'], ortu: ['semua', 'ortu'],
};

function build(role: Role, d: Partial<DB>, ctx: { studentId?: number; classId?: number | null; employeeId?: number; childIds: number[] }): Notif[] {
  const t = today();
  const out: Notif[] = [];
  const recent = addDays(t, -3);
  (d.announcements || [])
    .filter((a) => AUDIENCE[role].includes(a.audience) && a.published_at.slice(0, 10) >= recent)
    .forEach((a) => out.push({ id: `ann-${a.id}`, title: 'Pengumuman baru', desc: a.title, href: '/pengumuman/', tone: 'blue' }));

  if (role === 'siswa' || role === 'ortu') {
    const sid = ctx.studentId;
    const bills = (d.bills || []).filter((b) => b.student_id === sid && b.status !== 'lunas');
    const overdue = bills.filter((b) => b.due_date < t);
    const soon = bills.filter((b) => b.due_date >= t && b.due_date <= addDays(t, 7));
    if (overdue.length) out.push({ id: `bill-over-${t}`, title: `${overdue.length} tagihan lewat jatuh tempo`, desc: `Total ${rupiah(overdue.reduce((a, b) => a + b.amount - b.discount - b.paid_amount, 0))}`, href: '/keuangan/tagihan/', tone: 'red' });
    soon.forEach((b) => out.push({ id: `bill-soon-${b.id}`, title: 'Tagihan segera jatuh tempo', desc: `${b.description} · ${fmtDate(b.due_date)}`, href: '/keuangan/tagihan/', tone: 'amber' }));
    const submitted = new Set((d.submissions || []).filter((s) => s.student_id === sid).map((s) => s.assignment_id));
    (d.assignments || []).filter((a) => a.class_id === ctx.classId && !submitted.has(a.id) && a.due_date >= t && a.due_date <= addDays(t, 2))
      .forEach((a) => out.push({ id: `task-${a.id}`, title: 'Tenggat tugas', desc: `${a.title} · ${a.due_date === t ? 'hari ini' : fmtDate(a.due_date)}`, href: '/tugas/', tone: 'amber' }));
    const done = new Set((d.exam_results || []).filter((r) => r.student_id === sid).map((r) => r.exam_id));
    (d.exams || []).filter((e) => e.class_id === ctx.classId && !done.has(e.id) && e.date >= t && e.date <= addDays(t, 1))
      .forEach((e) => out.push({ id: `exam-${e.id}`, title: e.date === t ? 'Ujian hari ini' : 'Ujian besok', desc: `${e.name} · ${e.start_time}`, href: '/ujian/', tone: 'blue' }));
    (d.virtual_classes || []).filter((v) => v.class_id === ctx.classId && v.date === t)
      .forEach((v) => out.push({ id: `vc-${v.id}`, title: 'Kelas virtual hari ini', desc: `${v.title} · ${v.start_time}`, href: `/elearning/?c=${v.class_id}-${v.subject_id}`, tone: 'green' }));
    const ids = role === 'ortu' ? ctx.childIds : sid ? [sid] : [];
    (d.leave_requests || []).filter((l) => ids.includes(l.student_id) && l.status !== 'menunggu' && (l.reviewed_at || '').slice(0, 10) >= recent)
      .forEach((l) => out.push({ id: `leave-${l.id}-${l.status}`, title: `Izin ${l.status}`, desc: `${fmtDate(l.start_date)} · ${l.reviewed_by}`, href: '/izin/', tone: l.status === 'disetujui' ? 'green' : 'red' }));
  }

  if (role === 'guru') {
    const homeroom = (d.classes || []).find((c) => c.homeroom_id === ctx.employeeId);
    if (homeroom && !isWeekend(t) && !(d.student_attendance || []).some((a) => a.class_id === homeroom.id && a.date === t))
      out.push({ id: `att-${t}`, title: 'Presensi belum diisi', desc: `Kelas perwalian ${homeroom.name} hari ini`, href: '/presensi-siswa/', tone: 'amber' });
    if (homeroom) {
      const st = new Set((d.students || []).filter((s) => s.class_id === homeroom.id).map((s) => s.id));
      const pending = (d.leave_requests || []).filter((l) => l.status === 'menunggu' && st.has(l.student_id));
      if (pending.length) out.push({ id: `leave-pending-${pending.map((p) => p.id).join('-')}`, title: `${pending.length} pengajuan izin menunggu`, desc: `Siswa kelas ${homeroom.name}`, href: '/izin/', tone: 'amber' });
    }
    const mine = new Set((d.assignments || []).filter((a) => a.teacher_id === ctx.employeeId).map((a) => a.id));
    const ungraded = (d.submissions || []).filter((s) => mine.has(s.assignment_id) && s.score === null).length;
    if (ungraded) out.push({ id: `grade-${t}-${ungraded}`, title: `${ungraded} tugas perlu dinilai`, desc: 'Buka menu Tugas untuk memberi nilai', href: '/tugas/', tone: 'blue' });
    const dow = new Date(t + 'T00:00:00').getDay();
    const sessions = isWeekend(t) ? [] : (d.schedules || []).filter((s) => s.teacher_id === ctx.employeeId && s.day === dow);
    const filled = (d.teaching_journals || []).filter((j) => j.teacher_id === ctx.employeeId && j.date === t).length;
    if (sessions.length > filled) out.push({ id: `journal-${t}`, title: 'Jurnal mengajar', desc: `${sessions.length - filled} dari ${sessions.length} sesi hari ini belum diisi`, href: '/jurnal/', tone: 'amber' });
    (d.virtual_classes || []).filter((v) => v.teacher_id === ctx.employeeId && v.date === t)
      .forEach((v) => out.push({ id: `vc-${v.id}`, title: 'Anda mengajar kelas virtual', desc: `${v.title} · ${v.start_time}`, href: `/elearning/?c=${v.class_id}-${v.subject_id}`, tone: 'green' }));
  }

  if (['admin', 'kepsek', 'kesiswaan'].includes(role)) {
    const newApp = (d.applicants || []).filter((a) => a.status === 'baru').length;
    if (newApp) out.push({ id: `ppdb-${t}-${newApp}`, title: `${newApp} pendaftar baru`, desc: 'Menunggu verifikasi berkas PPDB', href: '/penerimaan/', tone: 'blue' });
    const pend = (d.leave_requests || []).filter((l) => l.status === 'menunggu').length;
    if (pend && role !== 'kepsek') out.push({ id: `leave-all-${t}-${pend}`, title: `${pend} pengajuan izin menunggu`, desc: 'Menunggu persetujuan wali kelas', href: '/izin/', tone: 'amber' });
  }

  if (['admin', 'kepsek', 'keuangan'].includes(role)) {
    const overdue = (d.bills || []).filter((b) => b.status !== 'lunas' && b.due_date < t);
    if (overdue.length) out.push({ id: `arrears-${t}`, title: `${overdue.length} tagihan lewat jatuh tempo`, desc: `Piutang ${rupiah(overdue.reduce((a, b) => a + b.amount - b.discount - b.paid_amount, 0))}`, href: '/keuangan/tagihan/', tone: 'red' });
  }
  if (role === 'keuangan') {
    const online = (d.payments || []).filter((p) => p.paid_at.startsWith(t) && p.received_by === 'Pembayaran Online');
    if (online.length) out.push({ id: `online-${t}-${online.length}`, title: `${online.length} pembayaran online hari ini`, desc: rupiah(online.reduce((a, p) => a + p.amount, 0)), href: '/keuangan/pembayaran/', tone: 'green' });
  }
  return out;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { student, employee, children } = useProfile();
  const { data } = useData(user ? KEYS[user.role] : []);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const storageKey = `ischool-notif-read-${user?.id}`;

  useEffect(() => {
    try { setRead(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { /* abaikan */ }
  }, [storageKey]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = useMemo(
    () => (data && user ? build(user.role, data as Partial<DB>, { studentId: student?.id, classId: student?.class_id, employeeId: employee?.id, childIds: children.map((c) => c.id) }) : []),
    [data, user, student, employee, children],
  );
  const unread = items.filter((i) => !read.includes(i.id));
  const markRead = (ids: string[]) => {
    const next = [...new Set([...read, ...ids])].slice(-300);
    setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* abaikan */ }
  };
  const tone = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500', green: 'bg-emerald-500' };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" title="Notifikasi" aria-label="Notifikasi">
        <Bell className="h-5 w-5" />
        {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Notifikasi</p>
            {unread.length > 0 && <button onClick={() => markRead(items.map((i) => i.id))} className="flex items-center gap-1 text-xs text-brand-600 hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Tandai semua dibaca</button>}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.href} onClick={() => { markRead([n.id]); setOpen(false); }} className={cn('flex gap-3 px-4 py-3 text-sm hover:bg-slate-50', !read.includes(n.id) && 'bg-brand-50/40')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', read.includes(n.id) ? 'bg-slate-200' : tone[n.tone])} />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{n.title}</span>
                    <span className="block truncate text-xs text-slate-500">{n.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!items.length && <p className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada notifikasi</p>}
        </div>
      )}
    </div>
  );
}
