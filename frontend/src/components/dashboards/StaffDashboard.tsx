'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Users, GraduationCap, UserPlus, Wallet, AlertTriangle, ClipboardCheck, Trophy, ShieldAlert, TrendingUp, Receipt } from 'lucide-react';
import { useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import { Card, StatCard, Loading, StatusBadge, Badge, Avatar, ProgressBar } from '@/components/ui';
import { TrendChart, BarsChart, DonutChart, STATUS_COLORS } from '@/components/charts';
import { indexBy } from '@/lib/scope';
import { avg, compactRupiah, fmtDate, fmtDateTime, periodLabel, round, rupiah, today } from '@/lib/utils';

export function StaffDashboard() {
  const { user } = useAuth();
  const { unitId } = useWorkspace();
  const { data } = useData(['students', 'employees', 'classes', 'units', 'applicants', 'bills', 'payments', 'student_attendance', 'employee_attendance', 'student_records', 'events', 'grades', 'fee_types']);

  const m = useMemo(() => {
    if (!data) return null;
    const inUnit = <T extends { unit_id: number | null }>(r: T) => !unitId || r.unit_id === unitId;
    const students = data.students.filter((s) => s.status === 'aktif' && inUnit(s));
    const sIds = new Set(students.map((s) => s.id));
    const studentsById = indexBy(data.students);
    const employees = data.employees.filter((e) => e.is_active && (!unitId || e.unit_id === unitId || e.unit_id === null));
    const teachers = employees.filter((e) => e.type === 'guru');
    const classes = data.classes.filter(inUnit);
    const applicants = data.applicants.filter(inUnit);

    // Attendance trend
    const byDate = new Map<string, { h: number; t: number }>();
    data.student_attendance.forEach((a) => {
      if (!sIds.has(a.student_id)) return;
      const x = byDate.get(a.date) || { h: 0, t: 0 };
      x.t++;
      if (a.status === 'H') x.h++;
      byDate.set(a.date, x);
    });
    const attTrend = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-15).map(([d, v]) => ({ label: fmtDate(d, { day: 'numeric', month: 'short' }), rate: round((v.h / v.t) * 100, 1) }));
    const attAvg = avg(attTrend.map((x) => x.rate));
    const todayAtt = byDate.get(today());
    const empToday = data.employee_attendance.filter((a) => a.date === today() && employees.some((e) => e.id === a.employee_id));

    // Finance
    const bills = data.bills.filter((b) => (b.student_id ? !unitId || sIds.has(b.student_id) :!unitId || applicants.some((a) => a.id === b.applicant_id)));
    const billIds = new Set(bills.map((b) => b.id));
    const payments = data.payments.filter((p) => billIds.has(p.bill_id));
    const month = today().slice(0, 7);
    const collectedMonth = payments.filter((p) => p.paid_at.startsWith(month)).reduce((a, p) => a + p.amount, 0);
    const outstanding = bills.reduce((a, b) => a + (b.amount - b.discount - b.paid_amount), 0);
    const overdue = bills.filter((b) => b.status !== 'lunas' && b.due_date < today());
    const revenue = new Map<string, number>();
    payments.forEach((p) => revenue.set(p.paid_at.slice(0, 7), (revenue.get(p.paid_at.slice(0, 7)) || 0) + p.amount));
    const revTrend = [...revenue.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([k, v]) => ({ label: periodLabel(k).slice(0, 3) + ' ' + k.slice(2, 4), value: v }));
    const billStatus = [
      { name: 'Lunas', value: bills.filter((b) => b.status === 'lunas').length, color: STATUS_COLORS.good },
      { name: 'Sebagian', value: bills.filter((b) => b.status === 'sebagian').length, color: STATUS_COLORS.warning },
      { name: 'Belum Bayar', value: bills.filter((b) => b.status === 'belum').length, color: STATUS_COLORS.critical },
    ];

    // per unit
    const perUnit = data.units.map((u) => {
      const st = data.students.filter((s) => s.status === 'aktif' && s.unit_id === u.id);
      const ids = new Set(st.map((s) => s.id));
      const g = data.grades.filter((x) => ids.has(x.student_id));
      return { label: u.code, siswa: st.length, nilai: round(avg(g.map((x) => x.final)), 1) || 0 };
    });

    const records = data.student_records.filter((r) => sIds.has(r.student_id));
    const recent = [...data.payments].filter((p) => billIds.has(p.bill_id)).sort((a, b) => b.paid_at.localeCompare(a.paid_at)).slice(0, 6);
    const arrears = new Map<number, number>();
    overdue.forEach((b) => b.student_id && arrears.set(b.student_id, (arrears.get(b.student_id) || 0) + (b.amount - b.discount - b.paid_amount)));
    const topArrears = [...arrears.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ student: studentsById.get(id)!, amount: v }));

    return { students, teachers, employees, classes, applicants, attTrend, attAvg, todayAtt, empToday, collectedMonth, outstanding, overdue, revTrend, billStatus, perUnit, records, recent, topArrears, studentsById, bills };
  }, [data, unitId]);

  if (!data || !m || !user) return <Loading />;
  const role = user.role;
  const classById = indexBy(data.classes);
  const pendingApplicants = m.applicants.filter((a) => a.status === 'baru' || a.status === 'verifikasi');
  const events = data.events.filter((e) => e.date >= today() && (!unitId || !e.unit_id || e.unit_id === unitId)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const month = today().slice(0, 7);
  const violationsMonth = m.records.filter((r) => r.type === 'pelanggaran' && r.date.startsWith(month)).length;
  const achievements = m.records.filter((r) => r.type === 'prestasi').length;
  const lunasRate = m.bills.length ? (m.billStatus[0].value / m.bills.length) * 100 : 0;

  const attendanceCard = (
    <Card title="Tren Kehadiran Siswa (%)" actions={<Link href="/presensi-siswa/" className="text-sm text-brand-600 hover:underline">Detail</Link>}>
      <TrendChart data={m.attTrend} dataKey="rate" domain={[80, 100]} name="Kehadiran" format={(v) => `${v}%`} />
    </Card>
  );
  const revenueCard = (
    <Card title="Penerimaan per Bulan" actions={<Link href="/keuangan/laporan/" className="text-sm text-brand-600 hover:underline">Laporan</Link>}>
      <BarsChart data={m.revTrend} bars={[{ key: 'value', name: 'Penerimaan' }]} format={(v) => compactRupiah(v).replace('Rp ', '')} />
    </Card>
  );
  const billCard = (
    <Card title="Status Tagihan">
      <DonutChart data={m.billStatus} />
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Tingkat pelunasan</span><span>{round(lunasRate, 1)}%</span></div>
        <ProgressBar value={lunasRate} tone="green" />
      </div>
    </Card>
  );
  const recentPayments = (
    <Card title="Pembayaran Terbaru" bodyClass="p-0">
      <ul className="divide-y divide-slate-100">
        {m.recent.map((p) => {
          const s = p.student_id ? m.studentsById.get(p.student_id) : null;
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{s?.name || 'Pendaftar PPDB'}</p>
                <p className="text-xs text-slate-500">{p.receipt_no} · {p.method} · {fmtDateTime(p.paid_at)}</p>
              </div>
              <span className="font-semibold text-emerald-600">{rupiah(p.amount)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
  const arrearsCard = (
    <Card title="Tunggakan Terbesar" actions={<Badge tone="red">{m.overdue.length} tagihan lewat jatuh tempo</Badge>} bodyClass="p-0">
      <ul className="divide-y divide-slate-100">
        {m.topArrears.map((a) => (
          <li key={a.student.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={a.student.name} className="h-8 w-8" />
              <div className="min-w-0">
                <p className="truncate font-medium">{a.student.name}</p>
                <p className="text-xs text-slate-500">{classById.get(a.student.class_id || 0)?.name} · NIS {a.student.nis}</p>
              </div>
            </div>
            <span className="font-semibold text-red-600">{rupiah(a.amount)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
  const ppdbCard = (
    <Card title="Pipeline PPDB" actions={<Link href="/penerimaan/" className="text-sm text-brand-600 hover:underline">Kelola</Link>}>
      <div className="grid grid-cols-5 gap-2 text-center">
        {(['baru', 'verifikasi', 'diterima', 'daftar_ulang', 'ditolak'] as const).map((s) => (
          <div key={s} className="rounded-lg bg-slate-50 p-2">
            <p className="text-xl font-bold text-slate-800">{m.applicants.filter((a) => a.status === s).length}</p>
            <StatusBadge status={s} />
          </div>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {pendingApplicants.slice(0, 4).map((a) => (
          <li key={a.id} className="flex items-center justify-between py-2">
            <span><b>{a.name}</b> <span className="text-slate-500">· {a.reg_no}</span></span>
            <StatusBadge status={a.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
  const eventsCard = (
    <Card title="Agenda Mendatang">
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <span className="font-bold leading-none">{new Date(e.date + 'T00:00:00').getDate()}</span>
              <span className="text-[10px]">{fmtDate(e.date, { month: 'short' })}</span>
            </div>
            <div><p className="font-medium">{e.title}</p><p className="text-xs text-slate-500">{e.location}</p></div>
          </li>
        ))}
      </ul>
    </Card>
  );
  const recordsCard = (
    <Card title="Catatan Kesiswaan Terbaru" actions={<Link href="/kesiswaan/" className="text-sm text-brand-600 hover:underline">Lihat semua</Link>} bodyClass="p-0">
      <ul className="divide-y divide-slate-100">
        {[...m.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{m.studentsById.get(r.student_id)?.name}</p>
              <p className="truncate text-xs text-slate-500">{r.description} · {fmtDate(r.date)}</p>
            </div>
            <StatusBadge status={r.type} />
          </li>
        ))}
      </ul>
    </Card>
  );
  const unitCard = (
    <Card title="Siswa Aktif per Unit">
      <BarsChart data={m.perUnit} bars={[{ key: 'siswa', name: 'Siswa aktif' }]} height={220} />
    </Card>
  );
  const gradeCard = (
    <Card title="Rata-rata Nilai Akhir per Unit">
      <BarsChart data={m.perUnit} bars={[{ key: 'nilai', name: 'Rata-rata nilai' }]} height={220} />
    </Card>
  );

  if (role === 'keuangan') {
    return (
      <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Penerimaan Bulan Ini" value={compactRupiah(m.collectedMonth)} icon={Wallet} tone="green" />
          <StatCard label="Total Piutang" value={compactRupiah(m.outstanding)} icon={Receipt} tone="amber" />
          <StatCard label="Lewat Jatuh Tempo" value={m.overdue.length} icon={AlertTriangle} tone="red" hint="tagihan" />
          <StatCard label="Tingkat Pelunasan" value={`${round(lunasRate, 1)}%`} icon={TrendingUp} tone="blue" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">{revenueCard}</div>
          {billCard}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {recentPayments}
          {arrearsCard}
        </div>
      </>
    );
  }

  if (role === 'kesiswaan') {
    return (
      <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Siswa Aktif" value={m.students.length} icon={Users} tone="blue" />
          <StatCard label="Pendaftar Perlu Diproses" value={pendingApplicants.length} icon={UserPlus} tone="violet" />
          <StatCard label="Pelanggaran Bulan Ini" value={violationsMonth} icon={ShieldAlert} tone="red" />
          <StatCard label="Prestasi Tercatat" value={achievements} icon={Trophy} tone="green" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">{attendanceCard}</div>
          {eventsCard}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {ppdbCard}
          {recordsCard}
        </div>
      </>
    );
  }

  // admin & kepsek
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Siswa Aktif" value={m.students.length} icon={Users} tone="blue" hint={`${m.classes.length} rombel`} />
        <StatCard label="Guru & Pegawai" value={m.employees.length} icon={GraduationCap} tone="violet" hint={`${m.teachers.length} guru`} />
        <StatCard label="Kehadiran Rata-rata" value={`${round(m.attAvg, 1) ?? '-'}%`} icon={ClipboardCheck} tone="green" hint={m.todayAtt ? `Hari ini ${round((m.todayAtt.h / m.todayAtt.t) * 100, 1)}%` : 'Hari ini belum diisi'} />
        <StatCard label="Penerimaan Bulan Ini" value={compactRupiah(m.collectedMonth)} icon={Wallet} tone="amber" hint={`Piutang ${compactRupiah(m.outstanding)}`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">{attendanceCard}</div>
        {billCard}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {unitCard}
        {gradeCard}
        {eventsCard}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {ppdbCard}
        {role === 'kepsek' ? recordsCard : recentPayments}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {revenueCard}
        <Card title="Presensi Pegawai Hari Ini">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Hadir', m.empToday.filter((a) => a.status === 'H').length, 'green'], ['Sakit/Izin', m.empToday.filter((a) => a.status === 'S' || a.status === 'I').length, 'amber'], ['Dinas Luar', m.empToday.filter((a) => a.status === 'DL').length, 'violet'], ['Belum Presensi', m.employees.length - m.empToday.length, 'slate']].map(([l, v, t]) => (
              <div key={l as string} className="rounded-lg bg-slate-50 p-3">
                <p className="text-2xl font-bold">{v as number}</p>
                <Badge tone={t as 'green'}>{l as string}</Badge>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">Guru melakukan presensi mandiri melalui menu Presensi. Rekap lengkap tersedia di menu Presensi Guru & Pegawai.</p>
        </Card>
      </div>
    </>
  );
}
