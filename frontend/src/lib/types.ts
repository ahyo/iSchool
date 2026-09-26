export type Role = 'admin' | 'kepsek' | 'keuangan' | 'kesiswaan' | 'guru' | 'siswa' | 'ortu';
export type UnitCode = 'SD' | 'SMP' | 'SMA' | 'SMK';

export interface Settings {
  id: number;
  name: string;
  foundation: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  vision: string;
  mission: string;
  ppdb_open: boolean;
}

export interface Unit {
  id: number;
  code: UnitCode;
  name: string;
  npsn: string;
  accreditation: string;
  address: string;
  head_id: number | null;
  min_grade: number;
  max_grade: number;
}

export interface AcademicYear {
  id: number;
  name: string;
  semester: 'Ganjil' | 'Genap';
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  name: string;
  role: Role;
  employee_id: number | null;
  student_id: number | null;
  guardian_id: number | null;
  is_active: boolean;
}

export interface Employee {
  id: number;
  nip: string;
  name: string;
  gender: 'L' | 'P';
  unit_id: number | null;
  type: 'guru' | 'tendik' | 'pimpinan';
  position: string;
  status: 'PNS' | 'PPPK' | 'GTY' | 'GTT' | 'Honorer' | 'PTY';
  education: string;
  phone: string;
  email: string;
  join_date: string;
  supervisor_id: number | null;
  is_active: boolean;
}

export interface Major {
  id: number;
  unit_id: number;
  code: string;
  name: string;
}

export interface Subject {
  id: number;
  unit_id: number;
  code: string;
  name: string;
  group: string;
  kkm: number;
}

export interface SchoolClass {
  id: number;
  unit_id: number;
  academic_year_id: number;
  grade: number;
  name: string;
  major_id: number | null;
  homeroom_id: number | null;
  room: string;
  capacity: number;
}

export interface Guardian {
  id: number;
  name: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
}

export type StudentStatus = 'aktif' | 'lulus' | 'pindah' | 'keluar';

export interface Student {
  id: number;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  religion: string;
  address: string;
  class_id: number | null;
  unit_id: number;
  guardian_id: number | null;
  status: StudentStatus;
  entry_year: number;
  entry_type: 'baru' | 'pindahan';
  origin_school: string;
  graduation_year: number | null;
  notes: string;
}

export interface Schedule {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  day: number; // 1 = Senin
  start_time: string;
  end_time: string;
}

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A';

export interface StudentAttendance {
  id: number;
  date: string;
  class_id: number;
  student_id: number;
  status: AttendanceStatus;
  note: string;
}

export interface EmployeeAttendance {
  id: number;
  date: string;
  employee_id: number;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus | 'DL';
  note: string;
}

export interface Material {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  title: string;
  description: string;
  content: string;
  link: string;
  created_at: string;
}

export interface Assignment {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  created_at: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  content: string;
  submitted_at: string;
  score: number | null;
  feedback: string;
}

export interface Question {
  q: string;
  options: string[];
  answer: number;
}

export interface Exam {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  name: string;
  type: 'UH' | 'PTS' | 'PAS' | 'PAT' | 'US' | 'UKK';
  date: string;
  start_time: string;
  duration: number;
  is_online: boolean;
  questions: Question[];
}

export interface ExamResult {
  id: number;
  exam_id: number;
  student_id: number;
  answers: number[];
  score: number;
  submitted_at: string;
}

export interface Grade {
  id: number;
  student_id: number;
  subject_id: number;
  academic_year_id: number;
  assignment: number | null;
  daily: number | null;
  midterm: number | null;
  final_exam: number | null;
  final: number | null;
  description: string;
}

export type FeeCategory = 'bulanan' | 'pendaftaran' | 'ujian' | 'kegiatan' | 'lainnya';

export interface FeeType {
  id: number;
  unit_id: number | null;
  name: string;
  category: FeeCategory;
  amount: number;
  description: string;
}

export type BillStatus = 'belum' | 'sebagian' | 'lunas';

export interface Bill {
  id: number;
  student_id: number | null;
  applicant_id: number | null;
  fee_type_id: number;
  period: string;
  description: string;
  amount: number;
  discount: number;
  paid_amount: number;
  due_date: string;
  status: BillStatus;
  created_at: string;
}

export interface Payment {
  id: number;
  bill_id: number;
  student_id: number | null;
  applicant_id: number | null;
  amount: number;
  method: 'Tunai' | 'Transfer Bank' | 'Virtual Account' | 'QRIS';
  receipt_no: string;
  paid_at: string;
  received_by: string;
  note: string;
}

export type ApplicantStatus = 'baru' | 'verifikasi' | 'diterima' | 'ditolak' | 'daftar_ulang';

export interface Applicant {
  id: number;
  reg_no: string;
  type: 'baru' | 'pindahan';
  unit_id: number;
  grade_target: number;
  major_id: number | null;
  name: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  religion: string;
  nisn: string;
  origin_school: string;
  transfer_reason: string;
  address: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  parent_occupation: string;
  status: ApplicantStatus;
  test_score: number | null;
  notes: string;
  student_id: number | null;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  category: 'Umum' | 'Akademik' | 'Keuangan' | 'Kesiswaan' | 'PPDB';
  audience: 'semua' | 'siswa' | 'ortu' | 'guru' | 'staf';
  unit_id: number | null;
  is_public: boolean;
  author: string;
  published_at: string;
}

export interface EventItem {
  id: number;
  title: string;
  date: string;
  end_date: string | null;
  location: string;
  description: string;
  unit_id: number | null;
}

export interface StudentRecord {
  id: number;
  student_id: number;
  type: 'pelanggaran' | 'prestasi' | 'konseling';
  category: string;
  description: string;
  points: number;
  date: string;
  recorded_by: string;
  follow_up: string;
}

export interface Promotion {
  id: number;
  student_id: number;
  academic_year_id: number;
  from_class_id: number | null;
  to_class_id: number | null;
  result: 'naik' | 'tinggal' | 'lulus';
  note: string;
  processed_at: string;
}

export interface Extracurricular {
  id: number;
  unit_id: number | null;
  name: string;
  coach_id: number | null;
  schedule: string;
  member_ids: number[];
}

export interface DB {
  settings: Settings[];
  units: Unit[];
  academic_years: AcademicYear[];
  users: User[];
  employees: Employee[];
  majors: Major[];
  subjects: Subject[];
  classes: SchoolClass[];
  guardians: Guardian[];
  students: Student[];
  schedules: Schedule[];
  student_attendance: StudentAttendance[];
  employee_attendance: EmployeeAttendance[];
  materials: Material[];
  assignments: Assignment[];
  submissions: Submission[];
  exams: Exam[];
  exam_results: ExamResult[];
  grades: Grade[];
  fee_types: FeeType[];
  bills: Bill[];
  payments: Payment[];
  applicants: Applicant[];
  announcements: Announcement[];
  events: EventItem[];
  student_records: StudentRecord[];
  promotions: Promotion[];
  extracurriculars: Extracurricular[];
}

export type Resource = keyof DB;
