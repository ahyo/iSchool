/* Implementasi aksi bisnis untuk mode demo (dijalankan di browser).
 * Aksi yang sama diimplementasikan di backend FastAPI: POST /api/actions/{name}. */
import type { Applicant, Bill, Payment, Promotion, Student, AttendanceStatus, EmployeeAttendance, User, Enrollment } from '../types';
import { getDB, insert, patch, commit, resetDB, removeRow } from './store';
import { DEMO_PASSWORD } from './seed';
import { runImport } from './importer';
import { availableCopies, lateDays, LIB_STAFF } from '../library';
import type { ImportKind } from '../importSpec';
import { computeFinal, nowISO, nowTime, pad, today, addDays, isWeekend } from '../utils';

type Handler = (p: any, user: User | null) => unknown;

function receiptNo() {
  const d = getDB();
  const ym = today().slice(0, 7).replace('-', '');
  return `KW/${ym}/${pad(d.payments.length + 1, 5)}`;
}

function applyPayment(bill: Bill, amount: number, method: Payment['method'], receivedBy: string, note = '') {
  const remaining = bill.amount - bill.discount - bill.paid_amount;
  if (amount <= 0) throw new Error('Nominal pembayaran tidak valid');
  if (amount > remaining) throw new Error(`Nominal melebihi sisa tagihan (${remaining.toLocaleString('id-ID')})`);
  const payment = insert('payments', {
    bill_id: bill.id, student_id: bill.student_id, applicant_id: bill.applicant_id, amount, method,
    receipt_no: receiptNo(), paid_at: nowISO(), received_by: receivedBy, note,
  });
  const paid = bill.paid_amount + amount;
  patch('bills', bill.id, { paid_amount: paid, status: paid >= bill.amount - bill.discount ? 'lunas' : 'sebagian' });
  return payment;
}

/** Buat/perbarui arsip kelas siswa pada semester tertentu (kelas, wali kelas, rekap kehadiran, catatan). */
function snapshotEnrollment(student: Student, academicYearId: number, extra: Partial<Enrollment> = {}) {
  const d = getDB();
  const ay = d.academic_years.find((y) => y.id === academicYearId);
  const cls = d.classes.find((c) => c.id === student.class_id);
  const existing = d.enrollments.find((e) => e.student_id === student.id && e.academic_year_id === academicYearId);
  if (existing && !cls) return patch('enrollments', existing.id, extra);
  const att = d.student_attendance.filter((a) => a.student_id === student.id && (!ay || (a.date >= ay.start_date && a.date <= ay.end_date)));
  const grades = d.grades.filter((g) => g.student_id === student.id && g.academic_year_id === academicYearId).map((g) => g.final).filter((x): x is number => x != null);
  const mean = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
  const snap = {
    unit_id: student.unit_id, class_id: cls?.id ?? null, class_name: cls?.name ?? existing?.class_name ?? '-', grade: cls?.grade ?? existing?.grade ?? 0,
    homeroom_name: d.employees.find((e) => e.id === cls?.homeroom_id)?.name ?? existing?.homeroom_name ?? '-',
    sick: att.filter((a) => a.status === 'S').length, permit: att.filter((a) => a.status === 'I').length, absent: att.filter((a) => a.status === 'A').length,
    homeroom_note: existing?.homeroom_note || (mean >= 85 ? 'Prestasi belajar sangat baik. Pertahankan!' : mean >= 75 ? 'Hasil belajar baik. Tingkatkan konsistensi belajar.' : 'Perlu meningkatkan semangat dan kedisiplinan belajar.'),
  };
  return existing
    ? patch('enrollments', existing.id, { ...snap, ...extra })
    : insert('enrollments', { student_id: student.id, academic_year_id: academicYearId, result: null, next_class_name: '', ...snap, ...extra });
}

export const actions: Record<string, Handler> = {
  'public.portal': () => {
    const d = getDB();
    return {
      settings: d.settings[0],
      units: d.units,
      majors: d.majors,
      announcements: d.announcements.filter((a) => a.is_public).sort((a, b) => b.published_at.localeCompare(a.published_at)),
      events: d.events.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date)),
      fee_types: d.fee_types.filter((f) => f.category === 'pendaftaran' || f.category === 'bulanan'),
      stats: {
        students: d.students.filter((s) => s.status === 'aktif').length,
        teachers: d.employees.filter((e) => e.type === 'guru' && e.is_active).length,
        classes: d.classes.length,
        alumni: d.students.filter((s) => s.status === 'lulus').length + 1250,
      },
    };
  },

  'ppdb.register': (p: Partial<Applicant>) => {
    const d = getDB();
    if (!d.settings[0].ppdb_open) throw new Error('Pendaftaran sedang ditutup');
    const unit = d.units.find((u) => u.id === Number(p.unit_id));
    if (!unit) throw new Error('Unit tidak valid');
    const a = insert('applicants', {
      reg_no: `PPDB-2027-${unit.code}-${pad(d.applicants.length + 1, 4)}`,
      type: p.type || 'baru', unit_id: unit.id, grade_target: Number(p.grade_target) || unit.min_grade, major_id: p.major_id ? Number(p.major_id) : null,
      name: p.name || '', gender: p.gender || 'L', birth_place: p.birth_place || '', birth_date: p.birth_date || '', religion: p.religion || 'Islam',
      nisn: p.nisn || '', origin_school: p.origin_school || '', transfer_reason: p.transfer_reason || '', address: p.address || '',
      parent_name: p.parent_name || '', parent_phone: p.parent_phone || '', parent_email: p.parent_email || '', parent_occupation: p.parent_occupation || '',
      status: 'baru', test_score: null, notes: '', student_id: null, created_at: nowISO(),
    } as Omit<Applicant, 'id'>);
    const fee = d.fee_types.find((f) => f.unit_id === unit.id && f.category === 'pendaftaran' && f.name.startsWith('Biaya Pendaftaran'));
    let bill: Bill | null = null;
    if (fee) {
      bill = insert('bills', {
        student_id: null, applicant_id: a.id, fee_type_id: fee.id, period: today().slice(0, 7), description: `${fee.name} - ${a.reg_no}`,
        amount: fee.amount, discount: 0, paid_amount: 0, due_date: addDays(today(), 7), status: 'belum', created_at: nowISO(),
      });
    }
    commit();
    return { applicant: a, bill };
  },

  'ppdb.status': (p: { reg_no: string; birth_date: string }) => {
    const d = getDB();
    const a = d.applicants.find((x) => x.reg_no.toLowerCase() === String(p.reg_no).trim().toLowerCase() && x.birth_date === p.birth_date);
    if (!a) throw new Error('Data pendaftaran tidak ditemukan. Periksa nomor pendaftaran dan tanggal lahir.');
    const bills = d.bills.filter((b) => b.applicant_id === a.id);
    return { applicant: a, bills, unit: d.units.find((u) => u.id === a.unit_id) };
  },

  'ppdb.pay': (p: { bill_id: number; method: Payment['method'] }) => {
    const bill = getDB().bills.find((b) => b.id === p.bill_id);
    if (!bill) throw new Error('Tagihan tidak ditemukan');
    const pay = applyPayment(bill, bill.amount - bill.discount - bill.paid_amount, p.method, 'Pembayaran Online');
    commit();
    return pay;
  },

  'ppdb.enroll': (p: { applicant_id: number; class_id: number }) => {
    const d = getDB();
    const a = d.applicants.find((x) => x.id === p.applicant_id);
    if (!a) throw new Error('Pendaftar tidak ditemukan');
    if (a.status !== 'diterima') throw new Error('Hanya pendaftar berstatus "diterima" yang dapat didaftarkan ulang');
    const cls = d.classes.find((c) => c.id === Number(p.class_id));
    if (!cls) throw new Error('Pilih kelas tujuan');
    const guardian = insert('guardians', { name: a.parent_name, relation: 'Orang Tua', phone: a.parent_phone, email: a.parent_email, occupation: a.parent_occupation, address: a.address });
    const year = new Date().getFullYear();
    const seq = d.students.filter((s) => s.unit_id === a.unit_id).length + 1;
    const student = insert('students', {
      nis: `${String(year).slice(2)}${a.unit_id}${pad(seq, 4)}`, nisn: a.nisn, name: a.name, gender: a.gender, birth_place: a.birth_place, birth_date: a.birth_date,
      religion: a.religion, address: a.address, class_id: cls.id, unit_id: a.unit_id, guardian_id: guardian.id, status: 'aktif', entry_year: year,
      entry_type: a.type, origin_school: a.origin_school, graduation_year: null, notes: a.type === 'pindahan' ? `Mutasi masuk: ${a.transfer_reason}` : '',
    } as Omit<Student, 'id'>);
    insert('users', { username: student.nis, password: DEMO_PASSWORD, name: student.name, role: 'siswa', employee_id: null, student_id: student.id, guardian_id: null, is_active: true });
    insert('users', { username: a.parent_phone || `ortu${guardian.id}`, password: DEMO_PASSWORD, name: guardian.name, role: 'ortu', employee_id: null, student_id: null, guardian_id: guardian.id, is_active: true });
    const pangkal = d.fee_types.find((f) => f.unit_id === a.unit_id && f.name.startsWith('Uang Pangkal'));
    if (pangkal) {
      insert('bills', { student_id: student.id, applicant_id: null, fee_type_id: pangkal.id, period: today().slice(0, 7), description: `${pangkal.name} - ${student.name}`, amount: pangkal.amount, discount: 0, paid_amount: 0, due_date: addDays(today(), 30), status: 'belum', created_at: nowISO() });
    }
    patch('applicants', a.id, { status: 'daftar_ulang', student_id: student.id });
    commit();
    return { student, username: student.nis, parent_username: a.parent_phone, password: DEMO_PASSWORD };
  },

  'bills.generate': (p: { fee_type_id: number; period: string; due_date: string; unit_id?: number; class_id?: number; description?: string }) => {
    const d = getDB();
    const fee = d.fee_types.find((f) => f.id === Number(p.fee_type_id));
    if (!fee) throw new Error('Jenis biaya tidak ditemukan');
    let targets = d.students.filter((s) => s.status === 'aktif');
    if (fee.unit_id) targets = targets.filter((s) => s.unit_id === fee.unit_id);
    if (p.unit_id) targets = targets.filter((s) => s.unit_id === Number(p.unit_id));
    if (p.class_id) targets = targets.filter((s) => s.class_id === Number(p.class_id));
    let created = 0;
    let skipped = 0;
    for (const s of targets) {
      if (d.bills.some((b) => b.student_id === s.id && b.fee_type_id === fee.id && b.period === p.period)) {
        skipped++;
        continue;
      }
      insert('bills', { student_id: s.id, applicant_id: null, fee_type_id: fee.id, period: p.period, description: p.description || `${fee.name} ${p.period}`, amount: fee.amount, discount: 0, paid_amount: 0, due_date: p.due_date, status: 'belum', created_at: nowISO() });
      created++;
    }
    commit();
    return { created, skipped };
  },

  'payments.pay': (p: { bill_id: number; amount: number; method: Payment['method']; note?: string }, user) => {
    const bill = getDB().bills.find((b) => b.id === Number(p.bill_id));
    if (!bill) throw new Error('Tagihan tidak ditemukan');
    const pay = applyPayment(bill, Number(p.amount), p.method, user?.role === 'siswa' || user?.role === 'ortu' ? 'Pembayaran Online' : user?.name || 'Petugas', p.note);
    commit();
    return pay;
  },

  'attendance.saveClass': (p: { class_id: number; date: string; entries: { student_id: number; status: AttendanceStatus; note: string }[] }) => {
    const d = getDB();
    for (const e of p.entries) {
      const ex = d.student_attendance.find((a) => a.student_id === e.student_id && a.date === p.date);
      if (ex) patch('student_attendance', ex.id, { status: e.status, note: e.note, class_id: p.class_id });
      else insert('student_attendance', { date: p.date, class_id: p.class_id, student_id: e.student_id, status: e.status, note: e.note });
    }
    commit();
    return { saved: p.entries.length };
  },

  'attendance.checkin': (p: { employee_id: number }) => {
    const d = getDB();
    const t = today();
    const ex = d.employee_attendance.find((a) => a.employee_id === p.employee_id && a.date === t);
    if (ex?.check_in) throw new Error('Anda sudah melakukan presensi masuk hari ini');
    const row = ex ? patch('employee_attendance', ex.id, { check_in: nowTime(), status: 'H' }) : insert('employee_attendance', { date: t, employee_id: p.employee_id, check_in: nowTime(), check_out: null, status: 'H', note: '' });
    commit();
    return row;
  },

  'attendance.checkout': (p: { employee_id: number }) => {
    const d = getDB();
    const ex = d.employee_attendance.find((a) => a.employee_id === p.employee_id && a.date === today());
    if (!ex?.check_in) throw new Error('Belum melakukan presensi masuk');
    const row = patch('employee_attendance', ex.id, { check_out: nowTime() });
    commit();
    return row;
  },

  'attendance.setEmployee': (p: { employee_id: number; date: string; status: EmployeeAttendance['status']; note: string }) => {
    const d = getDB();
    const ex = d.employee_attendance.find((a) => a.employee_id === p.employee_id && a.date === p.date);
    if (ex) patch('employee_attendance', ex.id, { status: p.status, note: p.note });
    else insert('employee_attendance', { date: p.date, employee_id: p.employee_id, check_in: null, check_out: null, status: p.status, note: p.note });
    commit();
    return { ok: true };
  },

  'submissions.submit': (p: { assignment_id: number; student_id: number; content: string }) => {
    const d = getDB();
    const ex = d.submissions.find((s) => s.assignment_id === p.assignment_id && s.student_id === p.student_id);
    if (ex?.score != null) throw new Error('Tugas sudah dinilai, tidak dapat diubah');
    const row = ex ? patch('submissions', ex.id, { content: p.content, submitted_at: nowISO() }) : insert('submissions', { assignment_id: p.assignment_id, student_id: p.student_id, content: p.content, submitted_at: nowISO(), score: null, feedback: '' });
    commit();
    return row;
  },

  'exams.submit': (p: { exam_id: number; student_id: number; answers: number[] }) => {
    const d = getDB();
    const exam = d.exams.find((e) => e.id === p.exam_id);
    if (!exam) throw new Error('Ujian tidak ditemukan');
    if (d.exam_results.some((r) => r.exam_id === exam.id && r.student_id === p.student_id)) throw new Error('Anda sudah mengerjakan ujian ini');
    const correct = exam.questions.filter((q, i) => p.answers[i] === q.answer).length;
    const score = exam.questions.length ? Math.round((correct / exam.questions.length) * 100) : 0;
    const row = insert('exam_results', { exam_id: exam.id, student_id: p.student_id, answers: p.answers, score, submitted_at: nowISO() });
    commit();
    return { ...row, correct, total: exam.questions.length };
  },

  'grades.save': (p: { rows: { student_id: number; subject_id: number; academic_year_id: number; assignment: number | null; daily: number | null; midterm: number | null; final_exam: number | null; description?: string }[] }) => {
    const d = getDB();
    for (const r of p.rows) {
      const final = computeFinal(r);
      const ex = d.grades.find((g) => g.student_id === r.student_id && g.subject_id === r.subject_id && g.academic_year_id === r.academic_year_id);
      if (ex) patch('grades', ex.id, { ...r, final, description: r.description ?? ex.description });
      else insert('grades', { ...r, final, description: r.description || '' });
    }
    commit();
    return { saved: p.rows.length };
  },

  'promotions.process': (p: { academic_year_id: number; decisions: { student_id: number; result: Promotion['result']; to_class_id: number | null; note?: string }[] }) => {
    const d = getDB();
    for (const dec of p.decisions) {
      const s = d.students.find((x) => x.id === dec.student_id);
      if (!s) continue;
      // Arsipkan kelas & keputusan pada semester berjalan sebelum siswa dipindahkan
      snapshotEnrollment(s, p.academic_year_id, { result: dec.result, next_class_name: dec.result === 'lulus' ? '' : d.classes.find((c) => c.id === dec.to_class_id)?.name || '' });
      insert('promotions', { student_id: s.id, academic_year_id: p.academic_year_id, from_class_id: s.class_id, to_class_id: dec.result === 'lulus' ? null : dec.to_class_id, result: dec.result, note: dec.note || '', processed_at: nowISO() });
      if (dec.result === 'lulus') patch('students', s.id, { status: 'lulus', class_id: null, graduation_year: new Date().getFullYear() });
      else if (dec.to_class_id) patch('students', s.id, { class_id: dec.to_class_id });
    }
    commit();
    return { processed: p.decisions.length };
  },

  'students.mutate': (p: { student_id: number; status: Student['status']; note: string }) => {
    const s = getDB().students.find((x) => x.id === p.student_id);
    if (!s) throw new Error('Siswa tidak ditemukan');
    patch('students', s.id, { status: p.status, class_id: p.status === 'aktif' ? s.class_id : null, notes: [s.notes, p.note].filter(Boolean).join('\n') });
    commit();
    return { ok: true };
  },

  'ekskul.toggle': (p: { id: number; student_id: number }) => {
    const e = getDB().extracurriculars.find((x) => x.id === p.id);
    if (!e) throw new Error('Ekstrakurikuler tidak ditemukan');
    const members = e.member_ids.includes(p.student_id) ? e.member_ids.filter((m) => m !== p.student_id) : [...e.member_ids, p.student_id];
    const row = patch('extracurriculars', e.id, { member_ids: members });
    commit();
    return row;
  },

  'elearning.complete': (p: { lesson_id: number; student_id: number; answers?: number[] }, user) => {
    const d = getDB();
    const lesson = d.lessons.find((l) => l.id === p.lesson_id);
    if (!lesson) throw new Error('Pelajaran tidak ditemukan');
    if (user?.role !== 'siswa' || user.student_id !== p.student_id) throw new Error('Hanya siswa yang bersangkutan yang dapat menyelesaikan pelajaran');
    let score: number | null = null;
    let correct = 0;
    if (lesson.type === 'kuis') {
      const answers = p.answers || [];
      if (answers.length < lesson.quiz.length || answers.some((a) => a < 0)) throw new Error('Jawab semua pertanyaan kuis terlebih dahulu');
      correct = lesson.quiz.filter((q, i) => answers[i] === q.answer).length;
      score = lesson.quiz.length ? Math.round((correct / lesson.quiz.length) * 100) : 0;
    }
    const ex = d.lesson_progress.find((x) => x.lesson_id === lesson.id && x.student_id === p.student_id);
    const best = ex?.quiz_score != null && score != null ? Math.max(ex.quiz_score, score) : score ?? ex?.quiz_score ?? null;
    const row = ex ? patch('lesson_progress', ex.id, { completed_at: nowISO(), quiz_score: best }) : insert('lesson_progress', { lesson_id: lesson.id, student_id: p.student_id, completed_at: nowISO(), quiz_score: score });
    commit();
    return { progress: row, score, correct, total: lesson.quiz.length };
  },

  'elearning.join': (p: { virtual_class_id: number; student_id: number }, user) => {
    const vc = getDB().virtual_classes.find((v) => v.id === p.virtual_class_id);
    if (!vc) throw new Error('Kelas virtual tidak ditemukan');
    if (user?.role === 'siswa' && user.student_id === p.student_id && !vc.attendee_ids.includes(p.student_id)) {
      patch('virtual_classes', vc.id, { attendee_ids: [...vc.attendee_ids, p.student_id] });
      commit();
    }
    return { link: vc.link };
  },

  'discussions.post': (p: { class_id: number; subject_id: number; parent_id?: number | null; title?: string; body: string }, user) => {
    if (!user || user.role === 'ortu') throw new Error('Anda tidak dapat mengirim diskusi');
    if (!p.body?.trim()) throw new Error('Isi diskusi tidak boleh kosong');
    if (!p.parent_id && !p.title?.trim()) throw new Error('Judul topik wajib diisi');
    const row = insert('discussions', { class_id: p.class_id, subject_id: p.subject_id, parent_id: p.parent_id || null, user_id: user.id, author: user.name, author_role: user.role, title: p.title?.trim() || '', body: p.body.trim(), pinned: false, created_at: nowISO() });
    commit();
    return row;
  },

  'discussions.delete': (p: { id: number }, user) => {
    const d = getDB();
    const row = d.discussions.find((x) => x.id === p.id);
    if (!row) throw new Error('Diskusi tidak ditemukan');
    if (!user || (row.user_id !== user.id && !['guru', 'admin'].includes(user.role))) throw new Error('Anda tidak dapat menghapus diskusi ini');
    d.discussions.filter((x) => x.parent_id === row.id).forEach((x) => removeRow('discussions', x.id));
    removeRow('discussions', row.id);
    commit();
    return { ok: true };
  },

  'discussions.pin': (p: { id: number }, user) => {
    const row = getDB().discussions.find((x) => x.id === p.id);
    if (!row) throw new Error('Diskusi tidak ditemukan');
    if (!user || !['guru', 'admin'].includes(user.role)) throw new Error('Hanya guru yang dapat menyematkan topik');
    const out = patch('discussions', row.id, { pinned: !row.pinned });
    commit();
    return out;
  },

  'academic_years.archive': (p: { id: number }, user) => {
    if (user?.role !== 'admin') throw new Error('Hanya admin yang dapat mengarsipkan rapor');
    const d = getDB();
    const active = d.students.filter((s) => s.status === 'aktif' && s.class_id);
    active.forEach((s) => snapshotEnrollment(s, p.id));
    commit();
    return { archived: active.length };
  },

  'import.run': (p: { kind: ImportKind; rows: Record<string, unknown>[]; dry_run?: boolean }, user) => {
    const allowed: Record<ImportKind, string[]> = { siswa: ['admin', 'kesiswaan'], pegawai: ['admin'], riwayat_kelas: ['admin', 'kesiswaan'], nilai: ['admin', 'kesiswaan'], buku: ['admin', 'pustakawan'] };
    if (!user || !allowed[p.kind]?.includes(user.role)) throw new Error('Anda tidak memiliki akses untuk impor data ini');
    if (!Array.isArray(p.rows) || !p.rows.length) throw new Error('File tidak berisi data');
    if (p.rows.length > 20000) throw new Error('Maksimal 20.000 baris per impor');
    return runImport(p.kind, p.rows, p.dry_run !== false);
  },

  'auth.changePassword': (p: { old_password: string; new_password: string }, user) => {
    const u = getDB().users.find((x) => x.id === user?.id);
    if (!u) throw new Error('Sesi tidak valid');
    if (u.password !== p.old_password) throw new Error('Password lama salah');
    if (!p.new_password || p.new_password.length < 6) throw new Error('Password baru minimal 6 karakter');
    patch('users', u.id, { password: p.new_password });
    commit();
    return { ok: true };
  },

  'leave.submit': (p: { student_id: number; type: 'S' | 'I'; start_date: string; end_date: string; reason: string; attachment_url?: string }, user) => {
    const d = getDB();
    const st = d.students.find((s) => s.id === Number(p.student_id));
    const allowed = st && ((user?.role === 'ortu' && st.guardian_id === user.guardian_id) || (user?.role === 'siswa' && user.student_id === st.id));
    if (!allowed) throw new Error('Anda hanya dapat mengajukan izin untuk anak/diri sendiri');
    if (!p.start_date || !p.end_date || p.end_date < p.start_date) throw new Error('Rentang tanggal tidak valid');
    if (!p.reason?.trim()) throw new Error('Alasan wajib diisi');
    const row = insert('leave_requests', { student_id: st!.id, user_id: user!.id, submitted_by: user!.name, type: p.type, start_date: p.start_date, end_date: p.end_date, reason: p.reason.trim(), attachment_url: p.attachment_url || '', status: 'menunggu', reviewed_by: '', review_note: '', reviewed_at: null, created_at: nowISO() });
    commit();
    return row;
  },

  'leave.cancel': (p: { id: number }, user) => {
    const lr = getDB().leave_requests.find((x) => x.id === p.id);
    if (!lr || lr.user_id !== user?.id) throw new Error('Pengajuan tidak ditemukan');
    if (lr.status !== 'menunggu') throw new Error('Pengajuan yang sudah diproses tidak dapat dibatalkan');
    removeRow('leave_requests', lr.id);
    commit();
    return { ok: true };
  },

  'leave.review': (p: { id: number; status: 'disetujui' | 'ditolak'; note?: string }, user) => {
    const d = getDB();
    const lr = d.leave_requests.find((x) => x.id === p.id);
    if (!lr) throw new Error('Pengajuan tidak ditemukan');
    const st = d.students.find((s) => s.id === lr.student_id)!;
    const cls = d.classes.find((c) => c.id === st.class_id);
    const isHomeroom = user?.role === 'guru' && cls?.homeroom_id === user.employee_id;
    if (!user || !(isHomeroom || ['admin', 'kesiswaan'].includes(user.role))) throw new Error('Hanya wali kelas atau bagian kesiswaan yang dapat memproses');
    if (lr.status !== 'menunggu') throw new Error('Pengajuan sudah diproses');
    patch('leave_requests', lr.id, { status: p.status, review_note: p.note || '', reviewed_by: user.name, reviewed_at: nowISO() });
    let days = 0;
    if (p.status === 'disetujui' && cls) {
      // Isi presensi otomatis untuk setiap hari sekolah dalam rentang izin
      for (let day = lr.start_date; day <= lr.end_date; day = addDays(day, 1)) {
        if (isWeekend(day)) continue;
        const ex = d.student_attendance.find((a) => a.student_id === st.id && a.date === day);
        const note = `${lr.type === 'S' ? 'Sakit' : 'Izin'}: ${lr.reason} (pengajuan online)`;
        if (ex) patch('student_attendance', ex.id, { status: lr.type, note });
        else insert('student_attendance', { date: day, class_id: cls.id, student_id: st.id, status: lr.type, note });
        days++;
      }
    }
    commit();
    return { ok: true, days };
  },

  // ---------------- Perpustakaan ----------------
  'library.borrow': (p: { book_id: number; student_id?: number | null; employee_id?: number | null; reservation_id?: number; notes?: string }, user) => {
    if (!user || !LIB_STAFF.includes(user.role)) throw new Error('Hanya pustakawan yang dapat mencatat peminjaman');
    const d = getDB();
    const cfg = d.settings[0];
    const book = d.books.find((b) => b.id === Number(p.book_id));
    if (!book) throw new Error('Buku tidak ditemukan');
    if (availableCopies(book, d.book_loans) <= 0) throw new Error(`Semua eksemplar "${book.title}" sedang dipinjam`);
    const sid = p.student_id ? Number(p.student_id) : null;
    const eid = p.employee_id ? Number(p.employee_id) : null;
    if (!!sid === !!eid) throw new Error('Pilih satu peminjam (siswa atau pegawai)');
    if (sid && d.students.find((x) => x.id === sid)?.status !== 'aktif') throw new Error('Siswa tidak aktif');
    if (eid && !d.employees.find((x) => x.id === eid)?.is_active) throw new Error('Pegawai tidak aktif');
    const mine = d.book_loans.filter((l) => (sid ? l.student_id === sid : l.employee_id === eid));
    const active = mine.filter((l) => !l.returned_at);
    if (active.length >= cfg.library_max_loans) throw new Error(`Batas peminjaman ${cfg.library_max_loans} buku sudah tercapai`);
    if (active.some((l) => l.due_date < today())) throw new Error('Peminjam masih memiliki buku yang terlambat dikembalikan');
    if (mine.some((l) => l.fine > 0 && !l.fine_paid)) throw new Error('Peminjam masih memiliki denda yang belum dibayar');
    if (active.some((l) => l.book_id === book.id)) throw new Error('Peminjam sedang meminjam buku yang sama');
    const loan = insert('book_loans', { book_id: book.id, student_id: sid, employee_id: eid, borrowed_at: today(), due_date: addDays(today(), cfg.library_loan_days), returned_at: null, extended: false, fine: 0, fine_paid: false, processed_by: user.name, notes: p.notes || '' });
    const resv = d.book_reservations.find((r) => r.id === Number(p.reservation_id)) || d.book_reservations.find((r) => r.book_id === book.id && r.status === 'menunggu' && (sid ? r.student_id === sid : r.employee_id === eid));
    if (resv) patch('book_reservations', resv.id, { status: 'dipinjam' });
    commit();
    return loan;
  },

  'library.return': (p: { loan_id: number; pay_fine?: boolean }, user) => {
    if (!user || !LIB_STAFF.includes(user.role)) throw new Error('Hanya pustakawan yang dapat mencatat pengembalian');
    const d = getDB();
    const loan = d.book_loans.find((l) => l.id === Number(p.loan_id));
    if (!loan) throw new Error('Peminjaman tidak ditemukan');
    if (loan.returned_at) throw new Error('Buku sudah dikembalikan');
    const fine = lateDays(loan) * d.settings[0].library_fine_per_day;
    const row = patch('book_loans', loan.id, { returned_at: today(), fine, fine_paid: fine === 0 || !!p.pay_fine });
    commit();
    return { ...row, late_days: lateDays(loan) };
  },

  'library.extend': (p: { loan_id: number }, user) => {
    const d = getDB();
    const loan = d.book_loans.find((l) => l.id === Number(p.loan_id));
    if (!loan) throw new Error('Peminjaman tidak ditemukan');
    const own = (user?.role === 'siswa' && loan.student_id === user.student_id) || (user?.role === 'guru' && loan.employee_id === user.employee_id);
    if (!user || !(own || LIB_STAFF.includes(user.role))) throw new Error('Anda tidak dapat memperpanjang peminjaman ini');
    if (loan.returned_at) throw new Error('Buku sudah dikembalikan');
    if (loan.extended) throw new Error('Peminjaman hanya dapat diperpanjang satu kali');
    if (loan.due_date < today()) throw new Error('Peminjaman sudah terlambat; kembalikan buku ke perpustakaan');
    if (d.book_reservations.some((r) => r.book_id === loan.book_id && r.status === 'menunggu')) throw new Error('Buku sedang direservasi peminjam lain');
    const row = patch('book_loans', loan.id, { due_date: addDays(loan.due_date, d.settings[0].library_loan_days), extended: true });
    commit();
    return row;
  },

  'library.payFine': (p: { loan_id: number }, user) => {
    if (!user || !LIB_STAFF.includes(user.role)) throw new Error('Hanya pustakawan yang dapat mencatat pembayaran denda');
    const loan = getDB().book_loans.find((l) => l.id === Number(p.loan_id));
    if (!loan || !loan.fine) throw new Error('Tidak ada denda');
    const row = patch('book_loans', loan.id, { fine_paid: true });
    commit();
    return row;
  },

  'library.reserve': (p: { book_id: number }, user) => {
    const d = getDB();
    const sid = user?.role === 'siswa' ? user.student_id : null;
    const eid = user?.role === 'guru' ? user.employee_id : null;
    if (!sid && !eid) throw new Error('Reservasi hanya untuk siswa dan guru');
    const book = d.books.find((b) => b.id === Number(p.book_id));
    if (!book) throw new Error('Buku tidak ditemukan');
    const mine = d.book_reservations.filter((r) => r.status === 'menunggu' && (sid ? r.student_id === sid : r.employee_id === eid));
    if (mine.some((r) => r.book_id === book.id)) throw new Error('Anda sudah mereservasi buku ini');
    if (mine.length >= 3) throw new Error('Maksimal 3 reservasi aktif');
    if (d.book_loans.some((l) => !l.returned_at && l.book_id === book.id && (sid ? l.student_id === sid : l.employee_id === eid))) throw new Error('Anda sedang meminjam buku ini');
    const row = insert('book_reservations', { book_id: book.id, student_id: sid, employee_id: eid, user_id: user!.id, status: 'menunggu', created_at: nowISO() });
    commit();
    return row;
  },

  'library.cancelReservation': (p: { id: number }, user) => {
    const r = getDB().book_reservations.find((x) => x.id === Number(p.id));
    if (!r) throw new Error('Reservasi tidak ditemukan');
    const own = (user?.role === 'siswa' && r.student_id === user.student_id) || (user?.role === 'guru' && r.employee_id === user.employee_id);
    if (!user || !(own || LIB_STAFF.includes(user.role))) throw new Error('Anda tidak dapat membatalkan reservasi ini');
    if (r.status !== 'menunggu') throw new Error('Reservasi sudah diproses');
    const row = patch('book_reservations', r.id, { status: 'batal' });
    commit();
    return row;
  },

  'library.settings': (p: { library_loan_days: number; library_max_loans: number; library_fine_per_day: number }, user) => {
    if (!user || !LIB_STAFF.includes(user.role)) throw new Error('Hanya pustakawan yang dapat mengubah pengaturan');
    const days = Number(p.library_loan_days), max = Number(p.library_max_loans), fine = Number(p.library_fine_per_day);
    if (!(days >= 1 && days <= 60) || !(max >= 1 && max <= 20) || !(fine >= 0)) throw new Error('Nilai pengaturan tidak valid');
    const row = patch('settings', getDB().settings[0].id, { library_loan_days: days, library_max_loans: max, library_fine_per_day: fine });
    commit();
    return row;
  },

  'academic_years.activate': (p: { id: number }) => {
    const d = getDB();
    d.academic_years.forEach((y) => patch('academic_years', y.id, { is_active: y.id === p.id }));
    commit();
    return { ok: true };
  },

  'demo.reset': () => {
    resetDB();
    return { ok: true };
  },
};
