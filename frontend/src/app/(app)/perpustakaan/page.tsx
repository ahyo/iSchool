'use client';
import { useState } from 'react';
import { useAuth, useProfile } from '@/lib/auth';
import { Loading, PageHeader, Tabs } from '@/components/ui';
import { Catalog, Circulation, LibraryReport, LibrarySettings, MyLoans, Reservations, useLibraryData } from '@/components/library';
import { LIB_STAFF } from '@/lib/library';

type StaffTab = 'sirkulasi' | 'katalog' | 'reservasi' | 'laporan' | 'pengaturan';

/** Perpustakaan: sirkulasi & katalog untuk pustakawan; katalog, reservasi, dan pinjaman untuk siswa/guru/ortu. */
export default function PerpustakaanPage() {
  const { user } = useAuth();
  const { student, employee } = useProfile();
  const d = useLibraryData();
  const isStaff = !!user && LIB_STAFF.includes(user.role);
  const [staffTab, setStaffTab] = useState<StaffTab>(user?.role === 'kepsek' ? 'laporan' : 'sirkulasi');
  const [tab, setTab] = useState<'pinjaman' | 'katalog'>('pinjaman');
  if (!d || !user) return <Loading />;

  if (isStaff || user.role === 'kepsek') {
    const pending = d.book_reservations.filter((r) => r.status === 'menunggu').length;
    const tabs = isStaff
      ? [{ value: 'sirkulasi' as const, label: 'Sirkulasi' }, { value: 'katalog' as const, label: 'Katalog' }, { value: 'reservasi' as const, label: `Reservasi (${pending})` }, { value: 'laporan' as const, label: 'Laporan' }, { value: 'pengaturan' as const, label: 'Pengaturan' }]
      : [{ value: 'laporan' as const, label: 'Laporan' }, { value: 'katalog' as const, label: 'Katalog' }];
    return (
      <>
        <PageHeader title="Perpustakaan" subtitle="Katalog koleksi, peminjaman & pengembalian, reservasi, denda, dan laporan" />
        <Tabs value={staffTab} onChange={setStaffTab} tabs={tabs} />
        {staffTab === 'sirkulasi' && isStaff && <Circulation d={d} />}
        {staffTab === 'katalog' && <Catalog d={d} canManage={isStaff} />}
        {staffTab === 'reservasi' && isStaff && <Reservations d={d} />}
        {staffTab === 'laporan' && <LibraryReport d={d} />}
        {staffTab === 'pengaturan' && isStaff && <LibrarySettings d={d} />}
      </>
    );
  }

  const who = user.role === 'guru' ? { employee_id: employee?.id } : { student_id: student?.id };
  const canAct = user.role === 'siswa' || user.role === 'guru';
  return (
    <>
      <PageHeader title="Perpustakaan" subtitle={user.role === 'ortu' ? `Pinjaman buku ${student?.name || ''}` : 'Cari buku, reservasi, dan pantau pinjaman Anda'} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pinjaman', label: user.role === 'ortu' ? 'Pinjaman Anak' : 'Pinjaman Saya' }, { value: 'katalog', label: 'Katalog Buku' }]} />
      {tab === 'pinjaman' ? <MyLoans d={d} who={who} canAct={canAct} /> : <Catalog d={d} canManage={false} reserveAs={canAct ? who : undefined} />}
    </>
  );
}
