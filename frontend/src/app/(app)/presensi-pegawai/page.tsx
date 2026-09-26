'use client';
import { useEffect, useState } from 'react';
import { Clock, Download, LogIn, LogOut, MapPin } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useProfile, useWorkspace } from '@/lib/auth';
import { Avatar, Badge, Button, Card, DataTable, Input, Loading, Modal, PageHeader, Select, StatCard, StatusBadge, Tabs, Field, run, type Column } from '@/components/ui';
import { indexBy } from '@/lib/scope';
import { downloadCSV, fmtDate, round, today } from '@/lib/utils';
import type { Employee, EmployeeAttendance } from '@/lib/types';

const LATE = '07:15';

function SelfService({ employee }: { employee: Employee }) {
  const { data } = useData(['employee_attendance']);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!data) return <Loading />;
  const mine = data.employee_attendance.filter((a) => a.employee_id === employee.id);
  const todayRow = mine.find((a) => a.date === today());
  const rows = mine.filter((a) => a.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const late = rows.filter((a) => a.check_in && a.check_in > LATE).length;
  const cols: Column<EmployeeAttendance>[] = [
    { key: 'date', header: 'Tanggal', render: (a) => fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'short' }) },
    { key: 'check_in', header: 'Masuk', render: (a) => <span className={a.check_in && a.check_in > LATE ? 'font-semibold text-red-600' : ''}>{a.check_in || '-'}</span> },
    { key: 'check_out', header: 'Pulang', render: (a) => a.check_out || '-' },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'note', header: 'Keterangan' },
  ];
  return (
    <>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="text-center">
            <p className="text-sm text-slate-500">{fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="my-2 font-mono text-4xl font-bold tabular-nums">{clock.toLocaleTimeString('id-ID')}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" /> Lokasi: area sekolah (simulasi geofence)</p>
            <div className="my-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Masuk</p><p className="text-xl font-bold">{todayRow?.check_in || '--:--'}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Pulang</p><p className="text-xl font-bold">{todayRow?.check_out || '--:--'}</p></div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!!todayRow?.check_in} onClick={() => run(() => api.action('attendance.checkin', { employee_id: employee.id }), 'Presensi masuk berhasil')}><LogIn className="h-4 w-4" /> Masuk</Button>
              <Button className="flex-1" variant="secondary" disabled={!todayRow?.check_in || !!todayRow?.check_out} onClick={() => run(() => api.action('attendance.checkout', { employee_id: employee.id }), 'Presensi pulang berhasil')}><LogOut className="h-4 w-4" /> Pulang</Button>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label="Hadir bulan ini" value={rows.filter((a) => a.status === 'H').length} icon={LogIn} tone="green" />
          <StatCard label="Terlambat" value={late} icon={Clock} tone="red" hint={`Batas ${LATE}`} />
          <StatCard label="Sakit / Izin" value={rows.filter((a) => a.status === 'S' || a.status === 'I').length} tone="amber" />
          <StatCard label="Dinas Luar" value={rows.filter((a) => a.status === 'DL').length} tone="violet" />
        </div>
      </div>
      <Card title="Riwayat Presensi" actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}>
        <DataTable rows={rows} columns={cols} pageSize={31} />
      </Card>
    </>
  );
}

function Recap() {
  const { unitId } = useWorkspace();
  const { user } = useAuth();
  const { data } = useData(['employees', 'employee_attendance', 'units']);
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [tab, setTab] = useState<'harian' | 'bulanan'>('harian');
  const [edit, setEdit] = useState<{ employee: Employee; status: EmployeeAttendance['status']; note: string } | null>(null);
  if (!data) return <Loading />;
  const units = indexBy(data.units);
  const emps = data.employees.filter((e) => e.is_active && (!unitId || e.unit_id === unitId || e.unit_id === null));
  type Row = Employee & { att?: EmployeeAttendance };
  const daily: Row[] = emps.map((e) => ({ ...e, att: data.employee_attendance.find((a) => a.employee_id === e.id && a.date === date) }));
  type MRow = Employee & { H: number; late: number; SI: number; DL: number; A: number; pct: number | null };
  const monthly: MRow[] = emps.map((e) => {
    const r = data.employee_attendance.filter((a) => a.employee_id === e.id && a.date.startsWith(month));
    return { ...e, H: r.filter((a) => a.status === 'H').length, late: r.filter((a) => a.check_in && a.check_in > LATE).length, SI: r.filter((a) => a.status === 'S' || a.status === 'I').length, DL: r.filter((a) => a.status === 'DL').length, A: r.filter((a) => a.status === 'A').length, pct: r.length ? round((r.filter((a) => a.status === 'H' || a.status === 'DL').length / r.length) * 100, 1) : null };
  });
  const canEdit = user?.role === 'admin';

  const dailyCols: Column<Row>[] = [
    { key: 'name', header: 'Nama', render: (e) => <div className="flex items-center gap-2"><Avatar name={e.name} className="h-7 w-7 text-[10px]" /><div><p className="font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.position}</p></div></div> },
    { key: 'unit', header: 'Unit', render: (e) => <Badge tone="blue">{e.unit_id ? units.get(e.unit_id)?.code : 'Yayasan'}</Badge> },
    { key: 'in', header: 'Masuk', render: (e) => <span className={e.att?.check_in && e.att.check_in > LATE ? 'font-semibold text-red-600' : ''}>{e.att?.check_in || '-'}</span> },
    { key: 'out', header: 'Pulang', render: (e) => e.att?.check_out || '-' },
    { key: 'status', header: 'Status', render: (e) => (e.att ? <StatusBadge status={e.att.status} /> : <Badge>Belum presensi</Badge>) },
    { key: 'note', header: 'Keterangan', render: (e) => <span className="text-xs">{e.att?.note}</span> },
    { key: 'a', header: '', render: (e) => canEdit && <Button size="sm" variant="ghost" onClick={() => setEdit({ employee: e, status: e.att?.status || 'S', note: e.att?.note || '' })}>Ubah</Button> },
  ];
  const monthlyCols: Column<MRow>[] = [
    { key: 'name', header: 'Nama', render: (e) => <span className="font-medium">{e.name}</span> },
    { key: 'position', header: 'Jabatan' },
    { key: 'H', header: 'Hadir' },
    { key: 'late', header: 'Terlambat', render: (e) => <span className={e.late > 2 ? 'font-bold text-red-600' : ''}>{e.late}</span> },
    { key: 'SI', header: 'Sakit/Izin' },
    { key: 'DL', header: 'Dinas Luar' },
    { key: 'pct', header: '% Kehadiran', sortValue: (e) => e.pct ?? 0, render: (e) => `${e.pct ?? '-'}%` },
  ];
  const present = daily.filter((d) => d.att?.status === 'H').length;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pegawai" value={emps.length} tone="blue" />
        <StatCard label="Hadir" value={present} tone="green" hint={fmtDate(date)} />
        <StatCard label="Terlambat" value={daily.filter((d) => d.att?.check_in && d.att.check_in > LATE).length} tone="red" />
        <StatCard label="Belum Presensi" value={daily.filter((d) => !d.att).length} tone="slate" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'harian', label: 'Harian' }, { value: 'bulanan', label: 'Rekap Bulanan' }]} />
      {tab === 'harian' ? (
        <Card actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />} title="Presensi Harian">
          <DataTable rows={daily} columns={dailyCols} pageSize={20} />
        </Card>
      ) : (
        <Card title="Rekap Bulanan" actions={<>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button size="sm" variant="secondary" onClick={() => downloadCSV(`presensi-pegawai-${month}.csv`, [['NIP', 'Nama', 'Jabatan', 'Hadir', 'Terlambat', 'Sakit/Izin', 'DL', '%'], ...monthly.map((m) => [m.nip, m.name, m.position, m.H, m.late, m.SI, m.DL, m.pct])])}><Download className="h-4 w-4" /> CSV</Button>
        </>}>
          <DataTable rows={monthly} columns={monthlyCols} pageSize={20} />
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Ubah presensi: ${edit?.employee.name}`} size="sm" footer={<Button onClick={() => run(async () => { await api.action('attendance.setEmployee', { employee_id: edit!.employee.id, date, status: edit!.status, note: edit!.note }); setEdit(null); }, 'Presensi diperbarui')}>Simpan</Button>}>
        {edit && <div className="space-y-3">
          <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as 'H' })} options={[{ value: 'H', label: 'Hadir' }, { value: 'S', label: 'Sakit' }, { value: 'I', label: 'Izin' }, { value: 'DL', label: 'Dinas Luar' }, { value: 'A', label: 'Tanpa Keterangan' }]} /></Field>
          <Field label="Keterangan"><Input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  );
}

export default function PresensiPegawaiPage() {
  const { user } = useAuth();
  const { employee } = useProfile();
  const isManager = user?.role === 'admin' || user?.role === 'kepsek';
  const [tab, setTab] = useState<'saya' | 'rekap'>(isManager ? 'rekap' : 'saya');
  return (
    <>
      <PageHeader title="Presensi Guru & Pegawai" subtitle="Presensi mandiri (check-in/check-out) dan rekap kehadiran pegawai" />
      {isManager && employee && <Tabs value={tab} onChange={setTab} tabs={[{ value: 'rekap', label: 'Rekap Pegawai' }, { value: 'saya', label: 'Presensi Saya' }]} />}
      {isManager && tab === 'rekap' ? <Recap /> : employee ? <SelfService employee={employee} /> : isManager ? <Recap /> : <Loading />}
    </>
  );
}
