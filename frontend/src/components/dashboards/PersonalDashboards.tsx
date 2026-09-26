'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { BookOpen, CalendarClock, ClipboardCheck, FileQuestion, GraduationCap, LogIn, LogOut, NotebookPen, Receipt, School, Users } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Empty, Loading, StatCard, StatusBadge, run } from '@/components/ui';
import { BarsChart } from '@/components/charts';
import { indexBy, teacherClassIds } from '@/lib/scope';
import { avg, DAYS, fmtDate, rupiah, round, today } from '@/lib/utils';

function todayDow() {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? 1 : d;
}

export function TeacherDashboard() {
  const { employee } = useProfile();
  const { data } = useData(['schedules', 'classes', 'subjects', 'students', 'assignments', 'submissions', 'exams', 'employee_attendance', 'student_attendance', 'announcements']);
  if (!data || !employee) return <Loading />;
  const cls = indexBy(data.classes);
  const sub = indexBy(data.subjects);
  const myClassIds = teacherClassIds(employee.id, data.schedules, data.classes);
  const myStudents = data.students.filter((s) => s.status === 'aktif' && s.class_id && myClassIds.has(s.class_id));
  const dow = todayDow();
  const weekend = [0, 6].includes(new Date().getDay());
  const todaySchedule = data.schedules.filter((s) => s.teacher_id === employee.id && s.day === dow).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const myAssign = data.assignments.filter((a) => a.teacher_id === employee.id);
  const toGrade = data.submissions.filter((s) => s.score === null && myAssign.some((a) => a.id === s.assignment_id));
  const upcomingExams = data.exams.filter((e) => e.teacher_id === employee.id && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const att = data.employee_attendance.find((a) => a.employee_id === employee.id && a.date === today());
  const homeroom = data.classes.find((c) => c.homeroom_id === employee.id);
  const homeroomFilled = homeroom && data.student_attendance.some((a) => a.class_id === homeroom.id && a.date === today());
  const announcements = data.announcements.filter((a) => a.audience === 'semua' || a.audience === 'guru').sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 4);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Kelas Diampu" value={myClassIds.size} icon={School} tone="blue" />
        <StatCard label="Total Siswa" value={myStudents.length} icon={Users} tone="violet" />
        <StatCard label="Tugas Perlu Dinilai" value={toGrade.length} icon={NotebookPen} tone="amber" />
        <StatCard label="Ujian Mendatang" value={upcomingExams.length} icon={FileQuestion} tone="green" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Presensi Saya Hari Ini">
          <p className="text-sm text-slate-500">{fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="my-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Masuk</p><p className="text-xl font-bold">{att?.check_in || '--:--'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Pulang</p><p className="text-xl font-bold">{att?.check_out || '--:--'}</p></div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!!att?.check_in} onClick={() => run(() => api.action('attendance.checkin', { employee_id: employee.id }), 'Presensi masuk tercatat')}><LogIn className="h-4 w-4" /> Masuk</Button>
            <Button className="flex-1" variant="secondary" disabled={!att?.check_in || !!att?.check_out} onClick={() => run(() => api.action('attendance.checkout', { employee_id: employee.id }), 'Presensi pulang tercatat')}><LogOut className="h-4 w-4" /> Pulang</Button>
          </div>
          {homeroom && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${homeroomFilled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              Wali kelas <b>{homeroom.name}</b>: presensi siswa hari ini {homeroomFilled ? 'sudah diisi' : 'belum diisi'}. <Link href="/presensi-siswa/" className="font-semibold underline">Isi presensi</Link>
            </div>
          )}
        </Card>
        <Card title={`Jadwal Mengajar ${weekend ? '(Senin)' : 'Hari Ini'}`} className="lg:col-span-2" bodyClass="p-0">
          {todaySchedule.length ? (
            <ul className="divide-y divide-slate-100">
              {todaySchedule.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                  <span className="w-28 font-mono text-slate-500">{s.start_time}–{s.end_time}</span>
                  <span className="flex-1 font-medium">{sub.get(s.subject_id)?.name}</span>
                  <Badge tone="blue">{cls.get(s.class_id)?.name}</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty text="Tidak ada jadwal mengajar" />}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Ujian Mendatang" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {upcomingExams.slice(0, 5).map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{e.name}</p>
                <p className="text-xs text-slate-500">{cls.get(e.class_id)?.name} · {fmtDate(e.date)} {e.start_time}</p>
              </li>
            ))}
          </ul>
          {!upcomingExams.length && <Empty />}
        </Card>
        <Card title="Pengumpulan Tugas Terbaru" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {toGrade.slice(0, 5).map((s) => {
              const a = myAssign.find((x) => x.id === s.assignment_id);
              return (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{data.students.find((x) => x.id === s.student_id)?.name}</p>
                  <p className="text-xs text-slate-500">{a?.title} · {cls.get(a?.class_id || 0)?.name}</p>
                </li>
              );
            })}
          </ul>
          {!toGrade.length && <Empty text="Semua tugas sudah dinilai" />}
          <div className="border-t border-slate-100 px-4 py-2"><Link href="/tugas/" className="text-sm text-brand-600 hover:underline">Buka menu tugas</Link></div>
        </Card>
        <AnnouncementList items={announcements} />
      </div>
    </>
  );
}

function AnnouncementList({ items }: { items: { id: number; title: string; content: string; published_at: string; category: string }[] }) {
  return (
    <Card title="Pengumuman" actions={<Link href="/pengumuman/" className="text-sm text-brand-600 hover:underline">Semua</Link>} bodyClass="p-0">
      <ul className="divide-y divide-slate-100">
        {items.map((a) => (
          <li key={a.id} className="px-4 py-3 text-sm">
            <div className="flex items-center gap-2"><Badge tone="blue">{a.category}</Badge><span className="text-xs text-slate-500">{fmtDate(a.published_at)}</span></div>
            <p className="mt-1 font-medium">{a.title}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StudentDashboard() {
  const { student, loaded } = useProfile();
  const { data } = useData(['classes', 'subjects', 'employees', 'schedules', 'student_attendance', 'grades', 'assignments', 'submissions', 'exams', 'exam_results', 'bills', 'announcements', 'units']);
  const m = useMemo(() => {
    if (!data || !student) return null;
    const att = data.student_attendance.filter((a) => a.student_id === student.id);
    const rate = att.length ? (att.filter((a) => a.status === 'H').length / att.length) * 100 : null;
    const grades = data.grades.filter((g) => g.student_id === student.id);
    const assignments = data.assignments.filter((a) => a.class_id === student.class_id);
    const submitted = new Set(data.submissions.filter((s) => s.student_id === student.id).map((s) => s.assignment_id));
    const pending = assignments.filter((a) => !submitted.has(a.id) && a.due_date >= today()).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const exams = data.exams.filter((e) => e.class_id === student.class_id && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
    const bills = data.bills.filter((b) => b.student_id === student.id && b.status !== 'lunas');
    return { att, rate, grades, pending, exams, bills, outstanding: bills.reduce((a, b) => a + b.amount - b.discount - b.paid_amount, 0) };
  }, [data, student]);

  if (!data || !loaded) return <Loading />;
  if (!student || !m) return <Empty text="Data siswa tidak ditemukan" />;
  const cls = data.classes.find((c) => c.id === student.class_id);
  const homeroom = data.employees.find((e) => e.id === cls?.homeroom_id);
  const sub = indexBy(data.subjects);
  const dow = todayDow();
  const schedule = data.schedules.filter((s) => s.class_id === student.class_id && s.day === dow).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const gradeChart = m.grades.map((g) => ({ label: sub.get(g.subject_id)?.code || '', nilai: g.final || 0 }));
  const announcements = data.announcements.filter((a) => ['semua', 'siswa', 'ortu'].includes(a.audience)).sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 4);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-800 p-5 text-white">
        <Avatar name={student.name} className="h-14 w-14 text-lg" />
        <div className="flex-1">
          <p className="text-lg font-bold">{student.name}</p>
          <p className="text-sm text-brand-100">{data.units.find((u) => u.id === student.unit_id)?.name} · Kelas {cls?.name} · NIS {student.nis} · NISN {student.nisn}</p>
          <p className="text-sm text-brand-100">Wali kelas: {homeroom?.name || '-'}</p>
        </div>
        <StatusBadge status={student.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Kehadiran" value={`${round(m.rate, 1) ?? '-'}%`} icon={ClipboardCheck} tone="green" hint={`${m.att.filter((a) => a.status === 'A').length} alpa, ${m.att.filter((a) => a.status === 'S').length} sakit, ${m.att.filter((a) => a.status === 'I').length} izin`} />
        <StatCard label="Rata-rata Nilai" value={round(avg(m.grades.map((g) => g.final)), 1) ?? '-'} icon={GraduationCap} tone="blue" hint={`${m.grades.length} mata pelajaran`} />
        <StatCard label="Tugas Belum Dikumpulkan" value={m.pending.length} icon={NotebookPen} tone="amber" />
        <StatCard label="Tagihan Belum Lunas" value={rupiah(m.outstanding)} icon={Receipt} tone="red" hint={`${m.bills.length} tagihan`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Jadwal ${[0, 6].includes(new Date().getDay()) ? 'Senin' : DAYS[dow]}`} bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {schedule.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-24 font-mono text-xs text-slate-500">{s.start_time}–{s.end_time}</span>
                <span className="flex-1">{sub.get(s.subject_id)?.name}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Nilai Akhir per Mata Pelajaran" className="lg:col-span-2">
          <BarsChart data={gradeChart} bars={[{ key: 'nilai', name: 'Nilai akhir' }]} height={240} />
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Tugas Mendatang" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {m.pending.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div><p className="font-medium">{a.title}</p><p className="text-xs text-slate-500">{sub.get(a.subject_id)?.name}</p></div>
                <Badge tone="amber"><CalendarClock className="mr-1 h-3 w-3" />{fmtDate(a.due_date, { day: 'numeric', month: 'short' })}</Badge>
              </li>
            ))}
          </ul>
          {!m.pending.length && <Empty text="Tidak ada tugas tertunda" />}
        </Card>
        <Card title="Ujian Mendatang" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {m.exams.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div><p className="font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.duration} menit · {e.is_online ? 'CBT online' : 'Tertulis'}</p></div>
                <Badge tone="violet"><BookOpen className="mr-1 h-3 w-3" />{fmtDate(e.date, { day: 'numeric', month: 'short' })}</Badge>
              </li>
            ))}
          </ul>
          {!m.exams.length && <Empty text="Tidak ada ujian terjadwal" />}
        </Card>
        <AnnouncementList items={announcements} />
      </div>
    </>
  );
}
