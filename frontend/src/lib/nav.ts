import {
  LayoutDashboard, Users, UserPlus, School, BookOpen, CalendarDays, Briefcase, Network, ClipboardCheck, Fingerprint,
  FileText, NotebookPen, MonitorPlay, History, FileQuestion, GraduationCap, TrendingUp, Wallet, Receipt, CreditCard, Tags, ShieldAlert,
  Megaphone, Settings, BarChart3, Trophy,
} from 'lucide-react';
import type { Role } from './types';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  labelFor?: Partial<Record<Role, string>>;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ['admin', 'kepsek', 'keuangan', 'kesiswaan', 'guru', 'siswa', 'ortu'];

export const NAV: NavGroup[] = [
  { title: 'Utama', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
    { href: '/pengumuman', label: 'Pengumuman & Agenda', icon: Megaphone, roles: ALL },
  ] },
  { title: 'Kesiswaan', items: [
    { href: '/penerimaan', label: 'PPDB & Mutasi', icon: UserPlus, roles: ['admin', 'kepsek', 'kesiswaan', 'keuangan'] },
    { href: '/siswa', label: 'Data Siswa', icon: Users, roles: ['admin', 'kepsek', 'kesiswaan', 'keuangan', 'guru'] },
    { href: '/kesiswaan', label: 'Prestasi & Pelanggaran', icon: ShieldAlert, roles: ['admin', 'kepsek', 'kesiswaan', 'guru', 'siswa', 'ortu'], labelFor: { siswa: 'Catatan Kesiswaan', ortu: 'Catatan Kesiswaan' } },
    { href: '/ekskul', label: 'Ekstrakurikuler', icon: Trophy, roles: ['admin', 'kepsek', 'kesiswaan', 'guru', 'siswa', 'ortu'] },
    { href: '/kenaikan', label: 'Kenaikan & Kelulusan', icon: TrendingUp, roles: ['admin', 'kepsek', 'kesiswaan', 'guru'] },
  ] },
  { title: 'Akademik', items: [
    { href: '/kelas', label: 'Kelas & Rombel', icon: School, roles: ['admin', 'kepsek', 'kesiswaan'] },
    { href: '/mapel', label: 'Mata Pelajaran', icon: BookOpen, roles: ['admin', 'kepsek'] },
    { href: '/elearning', label: 'E-Learning', icon: MonitorPlay, roles: ['admin', 'kepsek', 'guru', 'siswa', 'ortu'] },
    { href: '/jadwal', label: 'Jadwal Pelajaran', icon: CalendarDays, roles: ['admin', 'kepsek', 'guru', 'siswa', 'ortu'] },
    { href: '/materi', label: 'Materi Pelajaran', icon: FileText, roles: ['admin', 'kepsek', 'guru', 'siswa'] },
    { href: '/tugas', label: 'Tugas', icon: NotebookPen, roles: ['admin', 'kepsek', 'guru', 'siswa', 'ortu'] },
    { href: '/ujian', label: 'Ujian & CBT', icon: FileQuestion, roles: ['admin', 'kepsek', 'guru', 'siswa', 'ortu'] },
    { href: '/nilai', label: 'Nilai & Rapor', icon: GraduationCap, roles: ['admin', 'kepsek', 'guru', 'siswa', 'ortu'] },
    { href: '/riwayat', label: 'Riwayat Akademik', icon: History, roles: ['admin', 'kepsek', 'kesiswaan', 'guru', 'siswa', 'ortu'] },
  ] },
  { title: 'Presensi', items: [
    { href: '/presensi-siswa', label: 'Presensi Siswa', icon: ClipboardCheck, roles: ['admin', 'kepsek', 'kesiswaan', 'guru', 'siswa', 'ortu'], labelFor: { siswa: 'Kehadiran Saya', ortu: 'Kehadiran Anak' } },
    { href: '/presensi-pegawai', label: 'Presensi Guru & Pegawai', icon: Fingerprint, roles: ['admin', 'kepsek', 'guru', 'keuangan', 'kesiswaan'], labelFor: { guru: 'Presensi Saya', keuangan: 'Presensi Saya', kesiswaan: 'Presensi Saya' } },
  ] },
  { title: 'Keuangan', items: [
    { href: '/keuangan/tagihan', label: 'Tagihan Siswa', icon: Receipt, roles: ['admin', 'keuangan', 'kepsek', 'siswa', 'ortu'], labelFor: { siswa: 'Tagihan & Pembayaran', ortu: 'Tagihan & Pembayaran' } },
    { href: '/keuangan/pembayaran', label: 'Pembayaran', icon: CreditCard, roles: ['admin', 'keuangan', 'kepsek'] },
    { href: '/keuangan/biaya', label: 'Jenis Biaya', icon: Tags, roles: ['admin', 'keuangan'] },
    { href: '/keuangan/laporan', label: 'Laporan Keuangan', icon: BarChart3, roles: ['admin', 'keuangan', 'kepsek'] },
  ] },
  { title: 'Kepegawaian', items: [
    { href: '/pegawai', label: 'Data Pegawai', icon: Briefcase, roles: ['admin', 'kepsek'] },
    { href: '/struktur', label: 'Struktur Organisasi', icon: Network, roles: ALL },
  ] },
  { title: 'Sistem', items: [
    { href: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
  ] },
];

export function navFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)).map((i) => ({ ...i, label: i.labelFor?.[role] || i.label })),
  })).filter((g) => g.items.length);
}

export function canAccess(role: Role, path: string) {
  const clean = path.replace(/\/$/, '') || '/';
  for (const g of NAV) for (const i of g.items) if (clean === i.href || clean.startsWith(i.href + '/')) return i.roles.includes(role);
  return true;
}
