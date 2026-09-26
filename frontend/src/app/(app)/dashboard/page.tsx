'use client';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { StaffDashboard } from '@/components/dashboards/StaffDashboard';
import { StudentDashboard, TeacherDashboard } from '@/components/dashboards/PersonalDashboards';
import { fmtDate, today } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  return (
    <>
      <PageHeader title={`${greet}, ${user.name.split(',')[0]}`} subtitle={`Dashboard ${ROLE_LABEL[user.role]} · ${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} />
      {['admin', 'kepsek', 'keuangan', 'kesiswaan'].includes(user.role) && <StaffDashboard />}
      {user.role === 'guru' && <TeacherDashboard />}
      {(user.role === 'siswa' || user.role === 'ortu') && <StudentDashboard />}
    </>
  );
}
