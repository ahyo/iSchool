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
export function ReportCard({ student }: { student: Student }) {
  const { data } = useData(['grades', 'subjects', 'classes', 'employees', 'units', 'academic_years', 'student_attendance', 'extracurriculars', 'student_records', 'settings', 'majors']);
  if (!data) return <Loading />;
  const ay = data.academic_years.find((y) => y.is_active)!;
  const sub = indexBy(data.subjects);
  const cls = data.classes.find((c) => c.id === student.class_id);
  const unit = data.units.find((u) => u.id === student.unit_id);
  const homeroom = data.employees.find((e) => e.id === cls?.homeroom_id);
  const head = data.employees.find((e) => e.id === unit?.head_id);
  const grades = data.grades.filter((g) => g.student_id === student.id && g.academic_year_id === ay.id).sort((a, b) => a.subject_id - b.subject_id);
  const att = data.student_attendance.filter((a) => a.student_id === student.id);
  const ekskul = data.extracurriculars.filter((e) => e.member_ids.includes(student.id));
  const recs = data.student_records.filter((r) => r.student_id === student.id);
  const mean = round(avg(grades.map((g) => g.final)), 2);
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
        {[['Nama', student.name], ['Kelas', cls?.name || '-'], ['NIS / NISN', `${student.nis} / ${student.nisn}`], ['Semester', ay.semester], ['Sekolah', unit?.name], ['Tahun Ajaran', ay.name]].map(([k, v]) => (
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
              {[['Sakit', 'S'], ['Izin', 'I'], ['Tanpa Keterangan', 'A']].map(([l, k]) => <tr key={k}><td className="border border-slate-300 px-2 py-1">{l}</td><td className="border border-slate-300 px-2 py-1 text-center">{att.filter((a) => a.status === k).length} hari</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {recs.some((r) => r.type === 'prestasi') && (
        <div className="mt-4"><p className="mb-1 font-semibold">Prestasi</p>{recs.filter((r) => r.type === 'prestasi').map((r) => <p key={r.id}>• {r.description}</p>)}</div>
      )}
      <div className="mt-4 rounded border border-slate-300 p-3">
        <p className="font-semibold">Catatan Wali Kelas</p>
        <p className="mt-1 text-slate-700">{mean && mean >= 85 ? 'Pertahankan prestasi belajarmu dan terus kembangkan potensi diri.' : 'Tingkatkan kedisiplinan dan semangat belajar, terutama pada mata pelajaran yang belum tuntas.'}</p>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-4 text-center text-sm">
        <div><p>Orang Tua/Wali</p><div className="h-16" /><p className="border-t border-slate-400 pt-1">&nbsp;</p></div>
        <div><p>Wali Kelas</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-semibold">{homeroom?.name}</p></div>
        <div><p>Jakarta, {fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}<br />Kepala Sekolah</p><div className="h-10" /><p className="border-t border-slate-400 pt-1 font-semibold">{head?.name}</p></div>
      </div>
    </div>
  );
}
