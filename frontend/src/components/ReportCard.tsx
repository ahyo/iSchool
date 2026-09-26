'use client';
import { Fragment } from 'react';
import { useData } from '@/lib/api';
import { Loading } from './ui';
import { indexBy } from '@/lib/scope';
import { avg, fmtDate, predicate, round, today } from '@/lib/utils';
import type { Student } from '@/lib/types';

function describe(score: number | null, subject: string) {
  if (score === null) return '-';
  if (score >= 90) return `Sangat baik dalam menguasai seluruh capaian pembelajaran ${subject}.`;
  if (score >= 80) return `Baik dalam menguasai capaian pembelajaran ${subject}; perlu pendalaman pada beberapa materi.`;
  if (score >= 70) return `Cukup dalam memahami ${subject}; perlu bimbingan pada materi inti.`;
  return `Perlu bimbingan intensif untuk mencapai tujuan pembelajaran ${subject}.`;
}

/** Rapor (laporan hasil belajar) siswa — dapat dicetak. */
export function ReportCard({ student, academicYearId }: { student: Student; academicYearId?: number }) {
  const { data } = useData(['grades', 'subjects', 'classes', 'employees', 'units', 'academic_years', 'student_attendance', 'extracurriculars', 'student_records', 'settings', 'majors', 'enrollments']);
  if (!data) return <Loading />;
  const ay = data.academic_years.find((y) => (academicYearId ? y.id === academicYearId : y.is_active))!;
  const sub = indexBy(data.subjects);
  // Semester lampau memakai arsip (kelas & wali kelas saat itu); semester aktif memakai data kelas sekarang
  const enr = data.enrollments.find((e) => e.student_id === student.id && e.academic_year_id === ay.id);
  const cls = ay.is_active ? data.classes.find((c) => c.id === student.class_id) : undefined;
  const unit = data.units.find((u) => u.id === (enr?.unit_id ?? student.unit_id));
  const className = enr?.class_name ?? cls?.name ?? '-';
  const homeroomName = enr?.homeroom_name ?? data.employees.find((e) => e.id === cls?.homeroom_id)?.name;
  const head = data.employees.find((e) => e.id === unit?.head_id);
  const grades = data.grades.filter((g) => g.student_id === student.id && g.academic_year_id === ay.id).sort((a, b) => a.subject_id - b.subject_id);
  const inPeriod = (d: string) => d >= ay.start_date && d <= ay.end_date;
  const att = data.student_attendance.filter((a) => a.student_id === student.id && inPeriod(a.date));
  const absence: Record<string, number> = enr ? { S: enr.sick, I: enr.permit, A: enr.absent } : { S: att.filter((a) => a.status === 'S').length, I: att.filter((a) => a.status === 'I').length, A: att.filter((a) => a.status === 'A').length };
  const ekskul = ay.is_active ? data.extracurriculars.filter((e) => e.member_ids.includes(student.id)) : [];
  const recs = data.student_records.filter((r) => r.student_id === student.id && inPeriod(r.date));
  const mean = round(avg(grades.map((g) => g.final)), 2);
  const note = enr?.homeroom_note || (mean && mean >= 85 ? 'Pertahankan prestasi belajarmu dan terus kembangkan potensi diri.' : 'Tingkatkan kedisiplinan dan semangat belajar, terutama pada mata pelajaran yang belum tuntas.');
  const signDate = ay.is_active ? today() : ay.end_date;
  const groups = [...new Set(grades.map((g) => sub.get(g.subject_id)?.group || 'Umum'))];

  return (
    <div className="print-area rounded-xl border border-slate-200 bg-white p-6 text-sm sm:p-8">
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500">{data.settings[0].foundation}</p>
        <p className="text-lg font-bold uppercase">{unit?.name}</p>
        <p className="text-xs text-slate-500">NPSN {unit?.npsn} · {unit?.address}</p>
      </div>
      <p className="my-4 text-center text-base font-bold">LAPORAN HASIL BELAJAR (RAPOR)</p>
      <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
        {[['Nama', student.name], ['Kelas', className], ['NIS / NISN', `${student.nis} / ${student.nisn}`], ['Semester', ay.semester], ['Sekolah', unit?.name], ['Tahun Ajaran', ay.name]].map(([k, v]) => (
          <div key={k} className="flex"><span className="w-28 text-slate-500">{k}</span><span className="font-medium">: {v}</span></div>
        ))}
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-xs uppercase">
            <th className="border border-slate-300 px-2 py-2">No</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Mata Pelajaran</th>
            <th className="border border-slate-300 px-2 py-2">KKTP</th>
            <th className="border border-slate-300 px-2 py-2">Nilai Akhir</th>
            <th className="border border-slate-300 px-2 py-2">Predikat</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Capaian Kompetensi</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((grp) => (
            <Fragment key={grp}>
              <tr><td colSpan={6} className="border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold">Kelompok {grp}</td></tr>
              {grades.filter((g) => (sub.get(g.subject_id)?.group || 'Umum') === grp).map((g, i) => {
                const s = sub.get(g.subject_id);
                return (
                  <tr key={g.id}>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1.5">{s?.name}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{s?.kkm}</td>
                    <td className={`border border-slate-300 px-2 py-1.5 text-center font-semibold ${g.final !== null && g.final < (s?.kkm || 75) ? 'text-red-600' : ''}`}>{g.final ?? '-'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">{predicate(g.final)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-xs">{g.description || describe(g.final, s?.name || '')}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          <tr className="font-semibold"><td colSpan={3} className="border border-slate-300 px-2 py-1.5 text-right">Rata-rata</td><td className="border border-slate-300 px-2 py-1.5 text-center">{mean ?? '-'}</td><td colSpan={2} className="border border-slate-300" /></tr>
        </tbody>
      </table>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-semibold">Ekstrakurikuler</p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {ekskul.length ? ekskul.map((e) => <tr key={e.id}><td className="border border-slate-300 px-2 py-1">{e.name}</td><td className="border border-slate-300 px-2 py-1 text-center">Baik</td></tr>) : <tr><td className="border border-slate-300 px-2 py-1 text-slate-500">-</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-1 font-semibold">Ketidakhadiran</p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {[['Sakit', 'S'], ['Izin', 'I'], ['Tanpa Keterangan', 'A']].map(([l, k]) => <tr key={k}><td className="border border-slate-300 px-2 py-1">{l}</td><td className="border border-slate-300 px-2 py-1 text-center">{absence[k]} hari</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {recs.some((r) => r.type === 'prestasi') && (
        <div className="mt-4"><p className="mb-1 font-semibold">Prestasi</p>{recs.filter((r) => r.type === 'prestasi').map((r) => <p key={r.id}>• {r.description}</p>)}</div>
      )}
      <div className="mt-4 rounded border border-slate-300 p-3">
        <p className="font-semibold">Catatan Wali Kelas</p>
        <p className="mt-1 text-slate-700">{note}</p>
      </div>
      {enr?.result && (
        <div className="mt-3 rounded border border-slate-300 p-3">
          <p className="font-semibold">Keputusan</p>
          <p className="mt-1">{enr.result === 'lulus' ? 'Dinyatakan LULUS dari satuan pendidikan.' : enr.result === 'naik' ? `Naik ke kelas ${enr.next_class_name || '-'}` : `Tinggal di kelas ${enr.class_name}`}</p>
        </div>
      )}
      {!grades.length && <p className="mt-3 rounded bg-amber-50 p-3 text-amber-800">Belum ada nilai untuk semester ini.</p>}
      <div className="mt-10 grid grid-cols-3 gap-4 text-center text-sm">
        <div><p>Orang Tua/Wali</p><div className="h-16" /><p className="border-t border-slate-400 pt-1">&nbsp;</p></div>
        <div><p>Wali Kelas</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-semibold">{homeroomName}</p></div>
        <div><p>Jakarta, {fmtDate(signDate, { day: 'numeric', month: 'long', year: 'numeric' })}<br />Kepala Sekolah</p><div className="h-10" /><p className="border-t border-slate-400 pt-1 font-semibold">{head?.name}</p></div>
      </div>
    </div>
  );
}
