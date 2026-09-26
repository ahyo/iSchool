import type {
  DB, Unit, Employee, Subject, SchoolClass, Student, Guardian, Schedule, StudentAttendance,
  EmployeeAttendance, Grade, FeeType, Bill, Payment, Applicant, Announcement, EventItem,
  StudentRecord, Material, Assignment, Submission, Exam, ExamResult, Question, Major, User,
  Extracurricular, AttendanceStatus, Lesson, LessonProgress, VirtualClass, Discussion, AcademicYear, Enrollment, Expense, LeaveRequest, TeachingJournal, Book, BookLoan, BookReservation, ExamPeriod, ExamWindow,
} from '../types';
import { addDays, isWeekend, today, pad, computeFinal } from '../utils';

/** Deterministic PRNG so the demo data is the same on every browser. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE = ['Ahmad', 'Budi', 'Rizki', 'Fajar', 'Dimas', 'Arif', 'Bayu', 'Galih', 'Hendra', 'Ilham', 'Joko', 'Kevin', 'Lukman', 'Muhammad', 'Naufal', 'Oki', 'Putra', 'Raka', 'Satria', 'Taufik', 'Umar', 'Wahyu', 'Yoga', 'Zaki', 'Aditya', 'Farhan', 'Rafi', 'Daffa', 'Haikal', 'Alif'];
const FEMALE = ['Aisyah', 'Bunga', 'Citra', 'Dewi', 'Eka', 'Fitri', 'Gita', 'Hana', 'Indah', 'Jihan', 'Kirana', 'Laras', 'Maya', 'Nadia', 'Putri', 'Rani', 'Salsabila', 'Tiara', 'Umi', 'Vina', 'Wulan', 'Yuni', 'Zahra', 'Nabila', 'Alya', 'Keisha', 'Anisa', 'Syifa', 'Azzahra', 'Kayla'];
const LAST = ['Pratama', 'Saputra', 'Wijaya', 'Kusuma', 'Hidayat', 'Nugroho', 'Santoso', 'Setiawan', 'Permana', 'Ramadhan', 'Lestari', 'Maharani', 'Anggraini', 'Susanto', 'Purnomo', 'Firmansyah', 'Hakim', 'Utami', 'Rahmawati', 'Siregar', 'Nasution', 'Harahap', 'Situmorang', 'Wibowo', 'Gunawan', 'Halim', 'Syahputra', 'Kurniawan', 'Hasibuan', 'Putri'];
const CITIES = ['Jakarta', 'Bandung', 'Bogor', 'Depok', 'Bekasi', 'Tangerang', 'Surabaya', 'Semarang', 'Yogyakarta', 'Malang', 'Solo', 'Cirebon'];
const STREETS = ['Jl. Merdeka', 'Jl. Sudirman', 'Jl. Diponegoro', 'Jl. Pahlawan', 'Jl. Melati', 'Jl. Kenanga', 'Jl. Anggrek', 'Jl. Cempaka', 'Jl. Mawar', 'Jl. Flamboyan'];
const JOBS = ['Wiraswasta', 'Karyawan Swasta', 'PNS', 'TNI/Polri', 'Guru', 'Dokter', 'Pedagang', 'Petani', 'Buruh', 'Ibu Rumah Tangga'];
const RELIGIONS = ['Islam', 'Islam', 'Islam', 'Islam', 'Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha'];

const SUBJECTS: Record<string, [string, string, string][]> = {
  SD: [
    ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'], ['PP', 'Pendidikan Pancasila', 'Umum'], ['BIN', 'Bahasa Indonesia', 'Umum'],
    ['MTK', 'Matematika', 'Umum'], ['IPAS', 'Ilmu Pengetahuan Alam dan Sosial', 'Umum'], ['SBDP', 'Seni dan Budaya', 'Umum'],
    ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'], ['BIG', 'Bahasa Inggris', 'Muatan Lokal'],
  ],
  SMP: [
    ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'], ['PP', 'Pendidikan Pancasila', 'Umum'], ['BIN', 'Bahasa Indonesia', 'Umum'],
    ['MTK', 'Matematika', 'Umum'], ['IPA', 'Ilmu Pengetahuan Alam', 'Umum'], ['IPS', 'Ilmu Pengetahuan Sosial', 'Umum'],
    ['BIG', 'Bahasa Inggris', 'Umum'], ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'], ['INF', 'Informatika', 'Umum'],
    ['SB', 'Seni Budaya', 'Umum'],
  ],
  SMA: [
    ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'], ['PP', 'Pendidikan Pancasila', 'Umum'], ['BIN', 'Bahasa Indonesia', 'Umum'],
    ['MTK', 'Matematika', 'Umum'], ['BIG', 'Bahasa Inggris', 'Umum'], ['SEJ', 'Sejarah', 'Umum'],
    ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'], ['FIS', 'Fisika', 'Pilihan'], ['KIM', 'Kimia', 'Pilihan'],
    ['BIO', 'Biologi', 'Pilihan'], ['EKO', 'Ekonomi', 'Pilihan'], ['INF', 'Informatika', 'Pilihan'],
  ],
  SMK: [
    ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'], ['PP', 'Pendidikan Pancasila', 'Umum'], ['BIN', 'Bahasa Indonesia', 'Umum'],
    ['MTK', 'Matematika', 'Umum'], ['BIG', 'Bahasa Inggris', 'Umum'], ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'],
    ['INF', 'Informatika', 'Kejuruan'], ['DPK', 'Dasar-dasar Program Keahlian', 'Kejuruan'], ['KJ', 'Komputer dan Jaringan', 'Kejuruan'],
    ['AKL', 'Akuntansi Keuangan Lembaga', 'Kejuruan'], ['PKK', 'Projek Kreatif dan Kewirausahaan', 'Kejuruan'],
  ],
};

const QUESTION_BANK: Record<string, Question[]> = {
  MTK: [
    { q: 'Hasil dari 12 × 8 adalah ...', options: ['86', '96', '104', '112'], answer: 1 },
    { q: 'Nilai x dari persamaan 2x + 6 = 20 adalah ...', options: ['5', '6', '7', '8'], answer: 2 },
    { q: 'Luas persegi dengan sisi 9 cm adalah ...', options: ['36 cm²', '72 cm²', '81 cm²', '90 cm²'], answer: 2 },
    { q: 'Bilangan prima di antara 20 dan 30 adalah ...', options: ['21 dan 27', '23 dan 29', '25 dan 29', '23 dan 27'], answer: 1 },
    { q: '25% dari 360 adalah ...', options: ['80', '90', '100', '120'], answer: 1 },
  ],
  BIN: [
    { q: 'Gagasan utama dalam sebuah paragraf disebut ...', options: ['Kalimat penjelas', 'Ide pokok', 'Kesimpulan', 'Judul'], answer: 1 },
    { q: 'Kata baku dari "apotik" adalah ...', options: ['Apotik', 'Apotek', 'Apoteik', 'Apothek'], answer: 1 },
    { q: 'Teks yang bertujuan meyakinkan pembaca disebut teks ...', options: ['Narasi', 'Deskripsi', 'Persuasi', 'Eksposisi'], answer: 2 },
    { q: 'Sinonim kata "cerdas" adalah ...', options: ['Pandai', 'Malas', 'Lambat', 'Bodoh'], answer: 0 },
    { q: 'Tanda baca yang tepat untuk mengakhiri kalimat tanya adalah ...', options: ['Titik', 'Koma', 'Tanda seru', 'Tanda tanya'], answer: 3 },
  ],
  BIG: [
    { q: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 1 },
    { q: 'The opposite of "expensive" is ...', options: ['cheap', 'rich', 'costly', 'high'], answer: 0 },
    { q: 'I have lived here ___ 2020.', options: ['for', 'since', 'at', 'on'], answer: 1 },
    { q: '"Buku" in English is ...', options: ['Pen', 'Bag', 'Book', 'Table'], answer: 2 },
    { q: 'They ___ playing football yesterday.', options: ['is', 'are', 'was', 'were'], answer: 3 },
  ],
  IPA: [
    { q: 'Planet terdekat dengan Matahari adalah ...', options: ['Venus', 'Merkurius', 'Bumi', 'Mars'], answer: 1 },
    { q: 'Proses tumbuhan membuat makanan sendiri disebut ...', options: ['Respirasi', 'Fotosintesis', 'Transpirasi', 'Evaporasi'], answer: 1 },
    { q: 'Satuan SI untuk gaya adalah ...', options: ['Joule', 'Watt', 'Newton', 'Pascal'], answer: 2 },
    { q: 'Air mendidih pada suhu ... °C (tekanan 1 atm)', options: ['90', '95', '100', '110'], answer: 2 },
    { q: 'Organ yang memompa darah ke seluruh tubuh adalah ...', options: ['Paru-paru', 'Hati', 'Ginjal', 'Jantung'], answer: 3 },
  ],
  UMUM: [
    { q: 'Ibu kota negara Indonesia berdasarkan UU IKN adalah ...', options: ['Jakarta', 'Nusantara', 'Bandung', 'Surabaya'], answer: 1 },
    { q: 'Pancasila sebagai dasar negara disahkan pada tanggal ...', options: ['1 Juni 1945', '17 Agustus 1945', '18 Agustus 1945', '22 Juni 1945'], answer: 2 },
    { q: 'Semboyan negara Indonesia adalah ...', options: ['Tut Wuri Handayani', 'Bhinneka Tunggal Ika', 'Garuda Pancasila', 'Merdeka Belajar'], answer: 1 },
    { q: 'Lagu kebangsaan Indonesia diciptakan oleh ...', options: ['Ismail Marzuki', 'W.R. Supratman', 'C. Simanjuntak', 'Ibu Sud'], answer: 1 },
    { q: 'Sila keempat Pancasila dilambangkan dengan ...', options: ['Bintang', 'Rantai', 'Pohon beringin', 'Kepala banteng'], answer: 3 },
  ],
};

export function questionsFor(code: string): Question[] {
  if (QUESTION_BANK[code]) return QUESTION_BANK[code];
  if (['IPAS', 'FIS', 'KIM', 'BIO'].includes(code)) return QUESTION_BANK.IPA;
  return QUESTION_BANK.UMUM;
}

export const DEMO_PASSWORD = 'demo123';

export function buildSeed(): DB {
  const rand = mulberry32(20262027);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const TODAY = today();

  const personName = (g: 'L' | 'P') => `${pick(g === 'L' ? MALE : FEMALE)} ${pick(LAST)}`;
  const phone = () => `08${int(11, 99)}${int(1000, 9999)}${int(1000, 9999)}`;
  const address = () => `${pick(STREETS)} No. ${int(1, 150)}, ${pick(CITIES)}`;

  const units: Unit[] = [
    { id: 1, code: 'SD', name: 'SD Nusantara Cendekia', npsn: '20101234', accreditation: 'A', address: 'Jl. Pendidikan No. 1, Jakarta', head_id: null, min_grade: 1, max_grade: 6 },
    { id: 2, code: 'SMP', name: 'SMP Nusantara Cendekia', npsn: '20102345', accreditation: 'A', address: 'Jl. Pendidikan No. 1, Jakarta', head_id: null, min_grade: 7, max_grade: 9 },
    { id: 3, code: 'SMA', name: 'SMA Nusantara Cendekia', npsn: '20103456', accreditation: 'A', address: 'Jl. Pendidikan No. 3, Jakarta', head_id: null, min_grade: 10, max_grade: 12 },
    { id: 4, code: 'SMK', name: 'SMK Nusantara Cendekia', npsn: '20104567', accreditation: 'A', address: 'Jl. Pendidikan No. 5, Jakarta', head_id: null, min_grade: 10, max_grade: 12 },
  ];

  const majors: Major[] = [
    { id: 1, unit_id: 3, code: 'MIPA', name: 'Matematika dan Ilmu Pengetahuan Alam' },
    { id: 2, unit_id: 3, code: 'IPS', name: 'Ilmu Pengetahuan Sosial' },
    { id: 3, unit_id: 4, code: 'TKJ', name: 'Teknik Komputer dan Jaringan' },
    { id: 4, unit_id: 4, code: 'AKL', name: 'Akuntansi dan Keuangan Lembaga' },
  ];

  // Tahun ajaran per semester sejak 2020/2021 (untuk riwayat akademik); aktif = 2026/2027 Ganjil
  const academic_years: AcademicYear[] = [];
  const ayIdOf: Record<string, number> = {};
  for (let y = 2020; y <= 2026; y++) {
    for (const semester of ['Ganjil', 'Genap'] as const) {
      if (y === 2026 && semester === 'Genap') break;
      const id = academic_years.length + 1;
      ayIdOf[`${y}-${semester}`] = id;
      academic_years.push({
        id, name: `${y}/${y + 1}`, semester,
        start_date: semester === 'Ganjil' ? `${y}-07-13` : `${y + 1}-01-05`,
        end_date: semester === 'Ganjil' ? `${y}-12-18` : `${y + 1}-06-26`,
        is_active: y === 2026 && semester === 'Ganjil',
      });
    }
  }
  const AY = ayIdOf['2026-Ganjil'];

  // ---------- Employees ----------
  const employees: Employee[] = [];
  let eid = 0;
  const addEmp = (e: Omit<Employee, 'id' | 'nip' | 'phone' | 'email' | 'is_active' | 'join_date'> & Partial<Employee>) => {
    eid++;
    const emp: Employee = {
      id: eid,
      nip: `19${int(70, 95)}${pad(int(1, 12))}${pad(int(1, 28))}20${pad(int(5, 22))}${pad(int(1, 12))}${int(1, 2)}${pad(eid, 3)}`,
      phone: phone(),
      email: `${e.name.split(' ')[0].toLowerCase()}.${eid}@nusantaracendekia.sch.id`,
      join_date: `20${pad(int(5, 23))}-07-${pad(int(1, 20))}`,
      is_active: true,
      ...e,
    } as Employee;
    employees.push(emp);
    return emp;
  };

  const ketua = addEmp({ name: 'Dr. H. Suryadi Wibowo, M.Pd.', gender: 'L', unit_id: null, type: 'pimpinan', position: 'Ketua Yayasan', status: 'PTY', education: 'S3', supervisor_id: null });
  const bendahara = addEmp({ name: 'Rina Kartika, S.E.', gender: 'P', unit_id: null, type: 'tendik', position: 'Kepala Bagian Keuangan', status: 'PTY', education: 'S1', supervisor_id: ketua.id });
  addEmp({ name: 'Yusuf Maulana, A.Md.', gender: 'L', unit_id: null, type: 'tendik', position: 'Staf Keuangan', status: 'PTY', education: 'D3', supervisor_id: bendahara.id });
  addEmp({ name: 'Sri Wahyuni', gender: 'P', unit_id: null, type: 'tendik', position: 'Kepala Tata Usaha', status: 'PTY', education: 'S1', supervisor_id: ketua.id });

  const unitTeachers: Record<number, Employee[]> = {};
  const unitHeads: Record<number, Employee> = {};
  const kesiswaanStaff: Record<number, Employee> = {};
  const headNames: Record<string, [string, 'L' | 'P']> = {
    SD: ['Hj. Siti Nurhaliza, S.Pd.', 'P'],
    SMP: ['Drs. Bambang Supriyadi, M.Pd.', 'L'],
    SMA: ['Dra. Endang Lestari, M.Pd.', 'P'],
    SMK: ['Ir. Agus Salim, M.T.', 'L'],
  };
  const teacherCount: Record<string, number> = { SD: 9, SMP: 10, SMA: 11, SMK: 11 };
  for (const u of units) {
    const [hn, hg] = headNames[u.code];
    const head = addEmp({ name: hn, gender: hg, unit_id: u.id, type: 'pimpinan', position: `Kepala ${u.code}`, status: 'GTY', education: 'S2', supervisor_id: ketua.id });
    unitHeads[u.id] = head;
    u.head_id = head.id;
    if (u.code !== 'SD') {
      addEmp({ name: personName('L') + ', S.Pd.', gender: 'L', unit_id: u.id, type: 'pimpinan', position: 'Wakasek Kurikulum', status: 'GTY', education: 'S1', supervisor_id: head.id });
    }
    const ks = addEmp({ name: personName('P') + ', S.Pd.', gender: 'P', unit_id: u.id, type: 'pimpinan', position: u.code === 'SD' ? 'Koordinator Kesiswaan' : 'Wakasek Kesiswaan', status: 'GTY', education: 'S1', supervisor_id: head.id });
    kesiswaanStaff[u.id] = ks;
    addEmp({ name: personName(pick(['L', 'P'])), gender: 'L', unit_id: u.id, type: 'tendik', position: 'Staf Tata Usaha', status: 'PTY', education: 'SMA', supervisor_id: head.id });
    unitTeachers[u.id] = [];
    for (let i = 0; i < teacherCount[u.code]; i++) {
      const g: 'L' | 'P' = rand() > 0.45 ? 'P' : 'L';
      const t = addEmp({ name: personName(g) + ', S.Pd.', gender: g, unit_id: u.id, type: 'guru', position: 'Guru Mata Pelajaran', status: pick(['GTY', 'GTY', 'GTT', 'PPPK', 'Honorer']), education: pick(['S1', 'S1', 'S1', 'S2']), supervisor_id: head.id });
      unitTeachers[u.id].push(t);
    }
    if (u.code === 'SMA') {
      // Demo teacher (login "guru")
      const demoT = unitTeachers[u.id][0];
      demoT.name = 'Andi Prasetyo, S.Pd.';
      demoT.gender = 'L';
      demoT.email = 'andi.prasetyo@nusantaracendekia.sch.id';
    }
  }
  // Kesiswaan staff also teaches (kept simple)
  addEmp({ name: 'Maria Ulfa, S.Psi.', gender: 'P', unit_id: null, type: 'tendik', position: 'Konselor / Guru BK', status: 'GTY', education: 'S1', supervisor_id: ketua.id });

  // ---------- Subjects ----------
  const subjects: Subject[] = [];
  let sid = 0;
  for (const u of units) {
    for (const [code, name, group] of SUBJECTS[u.code]) {
      subjects.push({ id: ++sid, unit_id: u.id, code, name, group, kkm: u.code === 'SD' ? 70 : 75 });
    }
  }
  const unitSubjects = (uid: number) => subjects.filter((s) => s.unit_id === uid);

  // teacher -> subject assignment per unit
  const subjectTeacher: Record<number, number> = {};
  for (const u of units) {
    const subs = unitSubjects(u.id);
    const ts = unitTeachers[u.id];
    subs.forEach((s, i) => {
      subjectTeacher[s.id] = ts[i % ts.length].id;
    });
    if (u.code === 'SMA') {
      const mtk = subs.find((s) => s.code === 'MTK')!;
      const inf = subs.find((s) => s.code === 'INF')!;
      const cur = subjectTeacher[mtk.id];
      // swap so demo teacher (ts[0]) teaches Matematika & Informatika
      for (const s of subs) if (subjectTeacher[s.id] === ts[0].id) subjectTeacher[s.id] = cur;
      subjectTeacher[mtk.id] = ts[0].id;
      subjectTeacher[inf.id] = ts[0].id;
    }
  }

  // ---------- Classes ----------
  const classes: SchoolClass[] = [];
  let cid = 0;
  const addClass = (unit_id: number, grade: number, name: string, major_id: number | null, homeroom: Employee) => {
    const c: SchoolClass = { id: ++cid, unit_id, academic_year_id: AY, grade, name, major_id, homeroom_id: homeroom.id, room: `R-${unit_id}${pad(cid)}`, capacity: 32 };
    classes.push(c);
    return c;
  };
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  {
    const ts = unitTeachers[1];
    for (let g = 1; g <= 6; g++) addClass(1, g, `${g}A`, null, ts[g]);
    const ts2 = unitTeachers[2];
    let k = 1;
    for (let g = 7; g <= 9; g++) for (const p of ['A', 'B']) addClass(2, g, `${roman[g]}-${p}`, null, ts2[k++]);
    const ts3 = unitTeachers[3];
    addClass(3, 10, 'X-1', null, ts3[2]);
    addClass(3, 10, 'X-2', null, ts3[3]);
    addClass(3, 11, 'XI MIPA', 1, ts3[0]); // demo teacher homeroom
    addClass(3, 11, 'XI IPS', 2, ts3[4]);
    addClass(3, 12, 'XII MIPA', 1, ts3[5]);
    addClass(3, 12, 'XII IPS', 2, ts3[6]);
    const ts4 = unitTeachers[4];
    k = 1;
    for (let g = 10; g <= 12; g++) {
      addClass(4, g, `${roman[g]} TKJ`, 3, ts4[k++]);
      addClass(4, g, `${roman[g]} AKL`, 4, ts4[k++]);
    }
  }

  // ---------- Guardians & Students ----------
  const guardians: Guardian[] = [];
  const students: Student[] = [];
  let gid = 0;
  let stid = 0;
  const nisCounter: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const PER_CLASS = 8;
  for (const c of classes) {
    const unit = units.find((u) => u.id === c.unit_id)!;
    for (let i = 0; i < PER_CLASS; i++) {
      const g: 'L' | 'P' = rand() > 0.5 ? 'L' : 'P';
      const last = pick(LAST);
      const first = pick(g === 'L' ? MALE : FEMALE);
      const guardianGender = rand() > 0.5;
      const guardian: Guardian = {
        id: ++gid,
        name: `${guardianGender ? pick(MALE) : pick(FEMALE)} ${last}`,
        relation: guardianGender ? 'Ayah' : 'Ibu',
        phone: phone(),
        email: `ortu${gid}@mail.com`,
        occupation: pick(JOBS),
        address: address(),
      };
      guardians.push(guardian);
      const yearsIn = c.grade - unit.min_grade;
      const entryYear = 2026 - yearsIn;
      const birthYear = 2026 - (c.grade + 6);
      nisCounter[unit.id]++;
      students.push({
        id: ++stid,
        nis: `${String(entryYear).slice(2)}${unit.id}${pad(nisCounter[unit.id], 4)}`,
        nisn: `00${birthYear % 100}${int(100000, 999999)}`,
        name: `${first} ${last}`,
        gender: g,
        birth_place: pick(CITIES),
        birth_date: `${birthYear}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
        religion: pick(RELIGIONS),
        address: guardian.address,
        class_id: c.id,
        unit_id: c.unit_id,
        guardian_id: guardian.id,
        status: 'aktif',
        entry_year: entryYear,
        entry_type: rand() > 0.9 ? 'pindahan' : 'baru',
        origin_school: '',
        graduation_year: null,
        notes: '',
      });
    }
  }
  // Demo student & sibling (shared guardian)
  const demoClass = classes.find((c) => c.name === 'XI MIPA')!;
  const demoStudent = students.find((s) => s.class_id === demoClass.id)!;
  demoStudent.name = 'Rizky Aditya Pratama';
  demoStudent.gender = 'L';
  const demoGuardian = guardians.find((g) => g.id === demoStudent.guardian_id)!;
  demoGuardian.name = 'Hendra Pratama';
  demoGuardian.relation = 'Ayah';
  demoGuardian.occupation = 'Karyawan Swasta';
  demoGuardian.email = 'hendra.pratama@mail.com';
  const siblingClass = classes.find((c) => c.name === 'VIII-A')!;
  const sibling = students.find((s) => s.class_id === siblingClass.id)!;
  sibling.name = 'Nadia Putri Pratama';
  sibling.gender = 'P';
  sibling.guardian_id = demoGuardian.id;
  sibling.address = demoGuardian.address;
  demoStudent.address = demoGuardian.address;

  // Alumni (lulus tahun lalu)
  for (let i = 0; i < 6; i++) {
    const g: 'L' | 'P' = rand() > 0.5 ? 'L' : 'P';
    const unitId = pick([3, 4]);
    students.push({
      id: ++stid, nis: `23${unitId}${pad(900 + i, 4)}`, nisn: `0007${int(100000, 999999)}`, name: personName(g), gender: g,
      birth_place: pick(CITIES), birth_date: `2008-${pad(int(1, 12))}-${pad(int(1, 28))}`, religion: pick(RELIGIONS), address: address(),
      class_id: null, unit_id: unitId, guardian_id: null, status: 'lulus', entry_year: 2023, entry_type: 'baru', origin_school: '', graduation_year: 2026, notes: 'Lulus TA 2025/2026',
    });
  }

  // ---------- Schedules ----------
  const schedules: Schedule[] = [];
  let schid = 0;
  const SLOTS = [['07:30', '08:50'], ['08:50', '10:10'], ['10:30', '11:50'], ['12:30', '13:50']];
  classes.forEach((c, ci) => {
    let subs = unitSubjects(c.unit_id);
    if (c.major_id === 1) subs = subs.filter((s) => s.code !== 'EKO');
    if (c.major_id === 2) subs = subs.filter((s) => !['FIS', 'KIM'].includes(s.code));
    if (c.major_id === 3) subs = subs.filter((s) => s.code !== 'AKL');
    if (c.major_id === 4) subs = subs.filter((s) => s.code !== 'KJ');
    let k = ci;
    for (let day = 1; day <= 5; day++) {
      const slots = c.unit_id === 1 ? SLOTS.slice(0, 3) : SLOTS;
      for (const [start, end] of slots) {
        const s = subs[k % subs.length];
        k++;
        schedules.push({ id: ++schid, class_id: c.id, subject_id: s.id, teacher_id: subjectTeacher[s.id], day, start_time: start, end_time: end });
      }
    }
  });

  // ---------- Attendance (last ~20 school days) ----------
  const schoolDays: string[] = [];
  {
    let d = TODAY;
    while (schoolDays.length < 20) {
      if (!isWeekend(d)) schoolDays.unshift(d);
      d = addDays(d, -1);
    }
  }
  const student_attendance: StudentAttendance[] = [];
  let said = 0;
  const activeStudents = students.filter((s) => s.status === 'aktif');
  for (const day of schoolDays) {
    if (day === TODAY) continue; // hari ini diisi oleh guru saat demo
    for (const s of activeStudents) {
      const r = rand();
      const status: AttendanceStatus = r < 0.92 ? 'H' : r < 0.95 ? 'S' : r < 0.975 ? 'I' : 'A';
      student_attendance.push({ id: ++said, date: day, class_id: s.class_id!, student_id: s.id, status, note: status === 'S' ? 'Sakit (surat dokter)' : status === 'I' ? 'Izin keluarga' : '' });
    }
  }
  const employee_attendance: EmployeeAttendance[] = [];
  let eaid = 0;
  for (const day of schoolDays) {
    if (day === TODAY) continue;
    for (const e of employees) {
      const r = rand();
      const status = r < 0.93 ? 'H' : r < 0.96 ? 'S' : r < 0.98 ? 'I' : 'DL';
      const late = rand() < 0.1;
      employee_attendance.push({
        id: ++eaid, date: day, employee_id: e.id,
        check_in: status === 'H' ? `0${late ? 7 : 6}:${pad(late ? int(16, 45) : int(20, 59))}` : null,
        check_out: status === 'H' ? `${int(14, 16)}:${pad(int(0, 59))}` : null,
        status: status as EmployeeAttendance['status'], note: status === 'DL' ? 'Dinas luar: rapat MGMP' : '',
      });
    }
  }

  // ---------- Grades ----------
  const grades: Grade[] = [];
  let grid = 0;
  const classSubjects = (classId: number) => {
    const ids = new Set(schedules.filter((s) => s.class_id === classId).map((s) => s.subject_id));
    return subjects.filter((s) => ids.has(s.id));
  };
  for (const s of activeStudents) {
    const ability = int(62, 92);
    for (const sub of classSubjects(s.class_id!)) {
      const v = () => Math.min(100, Math.max(45, ability + int(-12, 12)));
      const g = { assignment: v(), daily: v(), midterm: rand() > 0.15 ? v() : null, final_exam: null as number | null };
      grades.push({ id: ++grid, student_id: s.id, subject_id: sub.id, academic_year_id: AY, ...g, final: computeFinal(g), description: '' });
    }
  }

  // ---------- Finance ----------
  const fee_types: FeeType[] = [];
  let ftid = 0;
  const spp: Record<string, number> = { SD: 350000, SMP: 450000, SMA: 550000, SMK: 600000 };
  const reg: Record<string, number> = { SD: 250000, SMP: 300000, SMA: 350000, SMK: 350000 };
  const feeByUnit: Record<number, Record<string, FeeType>> = {};
  for (const u of units) {
    feeByUnit[u.id] = {};
    const add = (name: string, category: FeeType['category'], amount: number, description: string, key: string) => {
      const f: FeeType = { id: ++ftid, unit_id: u.id, name, category, amount, description };
      fee_types.push(f);
      feeByUnit[u.id][key] = f;
    };
    add(`SPP ${u.code}`, 'bulanan', spp[u.code], 'Sumbangan Pembinaan Pendidikan bulanan', 'spp');
    add(`Biaya Pendaftaran ${u.code}`, 'pendaftaran', reg[u.code], 'Formulir & seleksi PPDB', 'reg');
    add(`Uang Pangkal ${u.code}`, 'pendaftaran', spp[u.code] * 10, 'Dana pengembangan untuk siswa baru/pindahan (dapat dicicil)', 'pangkal');
    add(`Ujian Tengah Semester ${u.code}`, 'ujian', u.code === 'SD' ? 75000 : 100000, 'Penyelenggaraan PTS', 'pts');
    add(`Ujian Akhir Semester ${u.code}`, 'ujian', u.code === 'SD' ? 100000 : 150000, 'Penyelenggaraan PAS', 'pas');
    add(`Kegiatan & Ekstrakurikuler ${u.code}`, 'kegiatan', 250000, 'Per semester', 'kegiatan');
  }
  fee_types.push({ id: ++ftid, unit_id: null, name: 'Seragam Sekolah (1 stel)', category: 'lainnya', amount: 450000, description: 'Pembelian seragam tambahan' });

  const bills: Bill[] = [];
type SeedPayment = Omit<Payment, 'status' | 'reference' | 'proof_url' | 'verified_by' | 'verified_at' | 'reject_reason'>;
  const payments: SeedPayment[] = [];
  let bid = 0;
  let pid = 0;
  let receipt = 0;
  const periods = ['2026-07', '2026-08', '2026-09', '2026-10'];
  const METHODS: Payment['method'][] = ['Tunai', 'Transfer Bank', 'Virtual Account', 'QRIS'];
  const payBill = (b: Bill, amount: number, date: string) => {
    payments.push({
      id: ++pid, bill_id: b.id, student_id: b.student_id, applicant_id: null, amount, method: pick(METHODS),
      receipt_no: `KW/${date.slice(0, 7).replace('-', '')}/${pad(++receipt, 5)}`, paid_at: `${date}T${pad(int(7, 15))}:${pad(int(0, 59))}:00`, received_by: 'Rina Kartika, S.E.', note: '',
    });
    b.paid_amount += amount;
    b.status = b.paid_amount >= b.amount - b.discount ? 'lunas' : 'sebagian';
  };
  for (const s of activeStudents) {
    const reliability = rand();
    for (const p of periods) {
      const f = feeByUnit[s.unit_id].spp;
      const discount = rand() < 0.05 ? Math.round(f.amount * 0.25) : 0;
      const b: Bill = { id: ++bid, student_id: s.id, applicant_id: null, fee_type_id: f.id, period: p, description: `${f.name} ${p}`, amount: f.amount, discount, paid_amount: 0, due_date: `${p}-10`, status: 'belum', created_at: `${p}-01T00:00:00` };
      bills.push(b);
      const net = b.amount - b.discount;
      if (p === '2026-07' || p === '2026-08') {
        if (reliability > 0.05) payBill(b, net, `${p}-${pad(int(1, 15))}`);
      } else if (p === '2026-09') {
        if (reliability > 0.35) payBill(b, net, `${p}-${pad(int(1, 20))}`);
        else if (reliability > 0.25) payBill(b, Math.round(net / 2), `${p}-${pad(int(1, 20))}`);
      } else if (reliability > 0.85) {
        payBill(b, net, TODAY);
      }
    }
    // Biaya PTS
    const pts = feeByUnit[s.unit_id].pts;
    const bp: Bill = { id: ++bid, student_id: s.id, applicant_id: null, fee_type_id: pts.id, period: '2026-09', description: `${pts.name} Ganjil 2026/2027`, amount: pts.amount, discount: 0, paid_amount: 0, due_date: '2026-09-30', status: 'belum', created_at: '2026-09-01T00:00:00' };
    bills.push(bp);
    if (reliability > 0.4) payBill(bp, pts.amount, `2026-09-${pad(int(2, 24))}`);
    // Kegiatan
    const kg = feeByUnit[s.unit_id].kegiatan;
    const bk: Bill = { id: ++bid, student_id: s.id, applicant_id: null, fee_type_id: kg.id, period: '2026-07', description: `${kg.name} Semester Ganjil`, amount: kg.amount, discount: 0, paid_amount: 0, due_date: '2026-08-31', status: 'belum', created_at: '2026-07-13T00:00:00' };
    bills.push(bk);
    if (reliability > 0.2) payBill(bk, kg.amount, `2026-08-${pad(int(1, 28))}`);
  }

  // ---------- PPDB applicants ----------
  const applicants: Applicant[] = [];
  let aid = 0;
  const appStatuses: Applicant['status'][] = ['baru', 'baru', 'verifikasi', 'verifikasi', 'diterima', 'ditolak'];
  for (let i = 0; i < 16; i++) {
    const u = units[i % 4];
    const type: Applicant['type'] = i % 3 === 0 ? 'pindahan' : 'baru';
    const g: 'L' | 'P' = rand() > 0.5 ? 'L' : 'P';
    const grade = type === 'baru' ? u.min_grade : int(u.min_grade + 1, u.max_grade - 1);
    const major = u.code === 'SMK' ? pick([3, 4]) : u.code === 'SMA' && grade > 10 ? pick([1, 2]) : null;
    const status = pick(appStatuses);
    const created = addDays(TODAY, -int(1, 30));
    const a: Applicant = {
      id: ++aid, reg_no: `PPDB-2027-${u.code}-${pad(aid, 4)}`, type, unit_id: u.id, grade_target: grade, major_id: major,
      name: personName(g), gender: g, birth_place: pick(CITIES), birth_date: `${2027 - grade - 6}-${pad(int(1, 12))}-${pad(int(1, 28))}`, religion: pick(RELIGIONS),
      nisn: `00${int(10, 20)}${int(100000, 999999)}`,
      origin_school: type === 'baru' ? (u.code === 'SD' ? 'TK Pelita Harapan' : u.code === 'SMP' ? `SD Negeri ${int(1, 20)} ${pick(CITIES)}` : `SMP Negeri ${int(1, 20)} ${pick(CITIES)}`) : `${u.code} Negeri ${int(1, 15)} ${pick(CITIES)}`,
      transfer_reason: type === 'pindahan' ? pick(['Mengikuti orang tua pindah tugas', 'Pindah domisili', 'Mencari lingkungan belajar yang lebih baik']) : '',
      address: address(), parent_name: personName(rand() > 0.5 ? 'L' : 'P'), parent_phone: phone(), parent_email: `calon${aid}@mail.com`, parent_occupation: pick(JOBS),
      status, test_score: status === 'baru' ? null : int(60, 95), notes: status === 'ditolak' ? 'Kuota kelas penuh' : '', student_id: null, created_at: `${created}T${pad(int(8, 20))}:${pad(int(0, 59))}:00`,
    };
    applicants.push(a);
    const regFee = feeByUnit[u.id].reg;
    const b: Bill = { id: ++bid, student_id: null, applicant_id: a.id, fee_type_id: regFee.id, period: created.slice(0, 7), description: `${regFee.name} - ${a.reg_no}`, amount: regFee.amount, discount: 0, paid_amount: 0, due_date: addDays(created, 7), status: 'belum', created_at: a.created_at };
    bills.push(b);
    if (status !== 'baru' || rand() > 0.5) {
      payments.push({ id: ++pid, bill_id: b.id, student_id: null, applicant_id: a.id, amount: b.amount, method: pick(METHODS), receipt_no: `KW/${created.slice(0, 7).replace('-', '')}/${pad(++receipt, 5)}`, paid_at: `${created}T10:00:00`, received_by: 'Sistem PPDB', note: 'Pembayaran pendaftaran' });
      b.paid_amount = b.amount;
      b.status = 'lunas';
    }
  }

  // ---------- LMS: materials, assignments, exams ----------
  const materials: Material[] = [];
  const assignments: Assignment[] = [];
  const submissions: Submission[] = [];
  const exams: Exam[] = [];
  const exam_results: ExamResult[] = [];
  let mid = 0, asid = 0, subid = 0, exid = 0, erid = 0;
  for (const c of classes) {
    const subs = classSubjects(c.id);
    const members = activeStudents.filter((s) => s.class_id === c.id);
    const chosen = c.id === demoClass.id ? subs.filter((s) => ['MTK', 'INF', 'BIN', 'BIG', 'FIS'].includes(s.code)) : subs.slice(0, 3);
    for (const sub of chosen) {
      const teacher = subjectTeacher[sub.id];
      materials.push({ id: ++mid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Bab 1: Pengantar ${sub.name}`, description: `Materi pengantar ${sub.name} untuk kelas ${c.name}.`, content: `Pada bab ini kita akan mempelajari konsep dasar ${sub.name}.\n\nTujuan pembelajaran:\n1. Memahami konsep-konsep dasar.\n2. Mampu menerapkan konsep dalam kehidupan sehari-hari.\n3. Mampu menyelesaikan latihan soal secara mandiri.`, link: 'https://belajar.kemdikbud.go.id', created_at: `${addDays(TODAY, -int(20, 40))}T08:00:00` });
      materials.push({ id: ++mid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Bab 2: Pendalaman ${sub.name}`, description: 'Ringkasan materi dan contoh soal.', content: 'Silakan pelajari ringkasan berikut dan kerjakan latihan pada akhir bab.', link: '', created_at: `${addDays(TODAY, -int(2, 12))}T08:00:00` });

      const past: Assignment = { id: ++asid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Latihan Bab 1 ${sub.name}`, description: 'Kerjakan soal latihan halaman 20-22 dan unggah jawaban Anda.', due_date: addDays(TODAY, -int(3, 8)), max_score: 100, created_at: `${addDays(TODAY, -14)}T08:00:00` };
      const upcoming: Assignment = { id: ++asid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Proyek Mini ${sub.name}`, description: 'Buat rangkuman/proyek sesuai petunjuk yang dibagikan di kelas.', due_date: addDays(TODAY, int(2, 9)), max_score: 100, created_at: `${addDays(TODAY, -2)}T08:00:00` };
      assignments.push(past, upcoming);
      for (const s of members) {
        if (rand() < 0.9) submissions.push({ id: ++subid, assignment_id: past.id, student_id: s.id, content: 'Jawaban telah saya kerjakan, terlampir pada tautan berikut.', submitted_at: `${addDays(past.due_date, -1)}T19:00:00`, score: rand() < 0.8 ? int(65, 98) : null, feedback: '' });
        if (rand() < 0.3 && s.id !== demoStudent.id) submissions.push({ id: ++subid, assignment_id: upcoming.id, student_id: s.id, content: 'Sudah saya kerjakan.', submitted_at: `${TODAY}T07:00:00`, score: null, feedback: '' });
      }
      // Exams
      const qs = questionsFor(sub.code);
      const done: Exam = { id: ++exid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, name: `Ulangan Harian 1 ${sub.name}`, type: 'UH', date: addDays(TODAY, -int(5, 15)), start_time: '08:00', end_time: '09:30', duration: 45, is_online: true, questions: qs };
      const soon: Exam = { id: ++exid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, name: `Penilaian Tengah Semester ${sub.name}`, type: 'PTS', date: addDays(TODAY, int(0, 10)), start_time: '07:30', end_time: '12:00', duration: 60, is_online: true, questions: qs };
      exams.push(done, soon);
      for (const s of members) {
        const answers = qs.map((q) => (rand() < 0.75 ? q.answer : int(0, 3)));
        const correct = answers.filter((a, i) => a === qs[i].answer).length;
        exam_results.push({ id: ++erid, exam_id: done.id, student_id: s.id, answers, score: Math.round((correct / qs.length) * 100), submitted_at: `${done.date}T08:40:00`, kind: 'utama' });
      }
    }
  }

  // Kuis CBT yang bisa langsung dicoba oleh akun demo siswa hari ini
  {
    const mtk = subjects.find((s) => s.unit_id === 3 && s.code === 'MTK')!;
    exams.push({ id: ++exid, class_id: demoClass.id, subject_id: mtk.id, teacher_id: subjectTeacher[mtk.id], name: 'Kuis Harian Matematika (CBT)', type: 'UH', date: TODAY, start_time: '00:00', end_time: '23:59', duration: 20, is_online: true, questions: [...questionsFor('MTK'), ...questionsFor('UMUM').slice(0, 3)] });
  }

  // ---------- E-Learning: pelajaran, progres, kelas virtual, diskusi ----------
  const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  const SAMPLE_DOC = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  const lessons: Lesson[] = [];
  const lesson_progress: LessonProgress[] = [];
  const virtual_classes: VirtualClass[] = [];
  const discussions: Discussion[] = [];
  let lid = 0, lpid = 0, vcid = 0, did = 0;
  for (const c of classes) {
    const subs = classSubjects(c.id);
    const members = activeStudents.filter((s) => s.class_id === c.id);
    const chosen = c.id === demoClass.id ? subs.filter((s) => ['MTK', 'INF', 'BIN', 'BIG', 'FIS'].includes(s.code)) : subs.slice(0, 3);
    for (const sub of chosen) {
      const teacher = subjectTeacher[sub.id];
      const qs = questionsFor(sub.code);
      const created = (d: number) => `${addDays(TODAY, -d)}T08:00:00`;
      const L = (module: string, order: number, title: string, type: Lesson['type'], extra: Partial<Lesson>, d: number): Lesson => ({
        id: ++lid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, module, order, title, type,
        content: '', video_url: '', file_url: '', duration: 10, quiz: [], is_published: true, created_at: created(d), ...extra,
      });
      const m1 = `Bab 1 · Pengantar ${sub.name}`;
      const m2 = `Bab 2 · Pendalaman ${sub.name}`;
      const list = [
        L(m1, 1, 'Tujuan Pembelajaran & Peta Konsep', 'teks', { duration: 8, content: `Selamat datang di kelas online ${sub.name} ${c.name}!\n\nSetelah menyelesaikan bab ini, kamu diharapkan mampu:\n• Menjelaskan konsep-konsep dasar ${sub.name}.\n• Menghubungkan konsep dengan contoh dalam kehidupan sehari-hari.\n• Menyelesaikan latihan soal secara mandiri.\n\nPeta konsep:\n1. Pengertian dan ruang lingkup\n2. Konsep inti dan istilah penting\n3. Penerapan dan latihan\n\nTips belajar: pelajari materi secara berurutan, catat hal yang belum dipahami, lalu tanyakan di forum diskusi.` }, 30),
        L(m1, 2, `Video: Pengantar ${sub.name}`, 'video', { duration: 12, video_url: SAMPLE_VIDEO, content: 'Tonton video berikut sampai selesai, lalu tuliskan tiga hal penting yang kamu pelajari di buku catatan.' }, 29),
        L(m1, 3, 'Ringkasan Materi Bab 1 (PDF)', 'dokumen', { duration: 15, file_url: SAMPLE_DOC, content: 'Unduh dan baca ringkasan materi. Dokumen ini juga dapat dicetak untuk belajar luring.' }, 28),
        L(m1, 4, 'Kuis Pemahaman Bab 1', 'kuis', { duration: 10, quiz: qs.slice(0, 3), content: 'Jawab pertanyaan berikut untuk mengukur pemahamanmu. Nilai minimal ketuntasan 70.' }, 27),
        L(m2, 1, 'Konsep Inti dan Contoh Soal', 'teks', { duration: 15, content: `Pada bab ini kita memperdalam konsep inti ${sub.name}.\n\nContoh 1\nPerhatikan permasalahan yang diberikan, identifikasi informasi yang diketahui dan yang ditanyakan, lalu pilih strategi penyelesaian yang tepat.\n\nContoh 2\nBandingkan dua pendekatan penyelesaian dan diskusikan kelebihan masing-masing di forum.\n\nRangkuman\nKonsep inti harus dipahami, bukan dihafal. Latih dengan soal bervariasi.` }, 12),
        L(m2, 2, 'Video: Pembahasan Soal', 'video', { duration: 14, video_url: SAMPLE_VIDEO, content: 'Video pembahasan langkah demi langkah.' }, 10),
        L(m2, 3, 'Kuis Pendalaman Bab 2', 'kuis', { duration: 10, quiz: qs.slice(2, 5), content: 'Kuis pendalaman. Kamu dapat mengulang kuis untuk memperbaiki nilai.' }, 8),
      ];
      if (c.id === demoClass.id && sub.code === 'MTK') list.push(L(m2, 4, 'Proyek: Penerapan dalam Kehidupan (draf)', 'teks', { is_published: false, content: 'Draf materi proyek — belum dipublikasikan ke siswa.' }, 1));
      lessons.push(...list);
      const published = list.filter((l) => l.is_published);
      for (const st of members) {
        const k = st.id === demoStudent.id ? (sub.code === 'MTK' ? 3 : int(1, 5)) : int(0, published.length);
        published.slice(0, k).forEach((l, i) => {
          const qScore = l.type === 'kuis' ? Math.round((l.quiz.filter(() => rand() < 0.8).length / l.quiz.length) * 100) : null;
          lesson_progress.push({ id: ++lpid, lesson_id: l.id, student_id: st.id, completed_at: `${addDays(TODAY, -Math.max(1, 25 - i * 3))}T${pad(int(15, 21))}:${pad(int(0, 59))}:00`, quiz_score: qScore });
        });
      }
      const room = `iSchool-${c.name}-${sub.code}`.replace(/\s+/g, '');
      const past = addDays(TODAY, -int(3, 8));
      virtual_classes.push({ id: ++vcid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Sesi Tatap Maya: Pengantar ${sub.name}`, date: past, start_time: '13:00', end_time: '14:00', platform: 'Jitsi', link: `https://meet.jit.si/${room}`, recording_url: SAMPLE_VIDEO, description: 'Pembahasan Bab 1 dan tanya jawab.', attendee_ids: members.filter(() => rand() < 0.85).map((m) => m.id) });
      const isDemoToday = c.id === demoClass.id && sub.code === 'MTK';
      virtual_classes.push({ id: ++vcid, class_id: c.id, subject_id: sub.id, teacher_id: teacher, title: `Sesi Tatap Maya: Pembahasan Soal ${sub.name}`, date: isDemoToday ? TODAY : addDays(TODAY, int(1, 6)), start_time: isDemoToday ? '19:00' : '13:00', end_time: isDemoToday ? '20:00' : '14:00', platform: 'Jitsi', link: `https://meet.jit.si/${room}-2`, recording_url: '', description: 'Siapkan pertanyaan dari Bab 2 sebelum sesi dimulai.', attendee_ids: [] });

      if (c.id === demoClass.id) {
        const tName = employees.find((e) => e.id === teacher)!.name;
        const isDemoTeacher = teacher === unitTeachers[3][0].id;
        const welcome: Discussion = { id: ++did, class_id: c.id, subject_id: sub.id, parent_id: null, user_id: isDemoTeacher ? 5 : 0, author: tName, author_role: 'guru', title: `Selamat datang di kelas online ${sub.name}`, body: 'Silakan pelajari materi sesuai urutan modul. Gunakan forum ini untuk bertanya atau berdiskusi dengan teman. Tetap santun ya!', pinned: true, created_at: `${addDays(TODAY, -30)}T07:00:00` };
        const ask = members.find((m) => m.id !== demoStudent.id)!;
        const q: Discussion = { id: ++did, class_id: c.id, subject_id: sub.id, parent_id: null, user_id: 0, author: ask.name, author_role: 'siswa', title: 'Bertanya tentang contoh soal Bab 2', body: 'Pak/Bu, pada contoh 2 kenapa pendekatan kedua lebih efisien? Saya masih bingung pada langkah ketiganya.', pinned: false, created_at: `${addDays(TODAY, -4)}T19:20:00` };
        discussions.push(welcome, q,
          { id: ++did, class_id: c.id, subject_id: sub.id, parent_id: q.id, user_id: 6, author: demoStudent.name, author_role: 'siswa', title: '', body: 'Menurut saya karena langkahnya lebih sedikit, jadi kemungkinan salah hitung juga lebih kecil.', pinned: false, created_at: `${addDays(TODAY, -4)}T20:05:00` },
          { id: ++did, class_id: c.id, subject_id: sub.id, parent_id: q.id, user_id: isDemoTeacher ? 5 : 0, author: tName, author_role: 'guru', title: '', body: 'Betul. Pendekatan kedua memanfaatkan sifat yang sudah kita pelajari di Bab 1 sehingga tidak perlu menghitung ulang dari awal. Kita bahas lagi di sesi tatap maya.', pinned: false, created_at: `${addDays(TODAY, -3)}T07:15:00` });
      }
    }
  }

  // ---------- Announcements, events ----------
  const announcements: Announcement[] = [
    { id: 1, title: 'Penerimaan Peserta Didik Baru (PPDB) TA 2027/2028 Dibuka', content: 'PPDB Yayasan Nusantara Cendekia untuk jenjang SD, SMP, SMA, dan SMK tahun ajaran 2027/2028 telah dibuka. Pendaftaran dapat dilakukan secara online melalui portal ini. Tersedia jalur reguler, prestasi, dan pindahan.', category: 'PPDB', audience: 'semua', unit_id: null, is_public: true, author: 'Panitia PPDB', published_at: `${addDays(TODAY, -3)}T08:00:00` },
    { id: 2, title: 'Jadwal Penilaian Tengah Semester (PTS) Ganjil', content: 'PTS semester ganjil akan dilaksanakan mulai minggu depan secara berbasis komputer (CBT). Siswa wajib melunasi biaya ujian dan membawa kartu peserta.', category: 'Akademik', audience: 'semua', unit_id: null, is_public: true, author: 'Wakasek Kurikulum', published_at: `${addDays(TODAY, -5)}T09:00:00` },
    { id: 3, title: 'Batas Pembayaran SPP Bulan Ini', content: 'Diingatkan kepada orang tua/wali bahwa batas pembayaran SPP adalah tanggal 10 setiap bulan. Pembayaran dapat dilakukan melalui Virtual Account, QRIS, transfer, atau tunai di loket keuangan.', category: 'Keuangan', audience: 'ortu', unit_id: null, is_public: false, author: 'Bagian Keuangan', published_at: `${addDays(TODAY, -8)}T10:00:00` },
    { id: 4, title: 'Tim Robotik SMK Juara 1 Tingkat Provinsi', content: 'Selamat kepada tim robotik SMK Nusantara Cendekia yang meraih juara 1 Kompetisi Robotik Pelajar tingkat provinsi. Tim akan mewakili provinsi ke tingkat nasional.', category: 'Kesiswaan', audience: 'semua', unit_id: 4, is_public: true, author: 'Wakasek Kesiswaan', published_at: `${addDays(TODAY, -10)}T13:00:00` },
    { id: 5, title: 'Rapat Dewan Guru Bulanan', content: 'Rapat dewan guru seluruh unit dilaksanakan hari Jumat pukul 13.30 di aula utama. Agenda: evaluasi pembelajaran dan persiapan PTS.', category: 'Umum', audience: 'guru', unit_id: null, is_public: false, author: 'Kepala Sekolah', published_at: `${addDays(TODAY, -1)}T07:00:00` },
    { id: 6, title: 'Gerakan Literasi Sekolah: 15 Menit Membaca', content: 'Mulai bulan ini setiap hari Senin–Kamis sebelum jam pelajaran pertama siswa wajib membaca buku non-pelajaran selama 15 menit.', category: 'Akademik', audience: 'siswa', unit_id: null, is_public: true, author: 'Tim Literasi', published_at: `${addDays(TODAY, -15)}T07:00:00` },
  ];
  const events: EventItem[] = [
    { id: 1, title: 'Penilaian Tengah Semester (PTS) Ganjil', date: addDays(TODAY, 2), end_date: addDays(TODAY, 8), location: 'Seluruh unit', description: 'PTS berbasis CBT', unit_id: null },
    { id: 2, title: 'Pembagian Rapor Tengah Semester', date: addDays(TODAY, 16), end_date: null, location: 'Ruang kelas masing-masing', description: 'Orang tua/wali hadir mengambil rapor', unit_id: null },
    { id: 3, title: 'Peringatan Hari Sumpah Pemuda', date: '2026-10-28', end_date: null, location: 'Lapangan utama', description: 'Upacara dan lomba antar kelas', unit_id: null },
    { id: 4, title: 'Open House PPDB 2027/2028', date: addDays(TODAY, 21), end_date: null, location: 'Aula Yayasan', description: 'Presentasi program sekolah dan tur fasilitas', unit_id: null },
    { id: 5, title: 'Kunjungan Industri Kelas XI SMK', date: addDays(TODAY, 12), end_date: null, location: 'Kawasan Industri Cikarang', description: 'Kunjungan ke mitra DU/DI', unit_id: 4 },
    { id: 6, title: 'Pentas Seni SD', date: addDays(TODAY, 30), end_date: null, location: 'Aula SD', description: 'Pentas seni dan budaya siswa SD', unit_id: 1 },
  ];

  const student_records: StudentRecord[] = [];
  let srid = 0;
  const VIOLATIONS: [string, string, number][] = [['Kedisiplinan', 'Terlambat masuk sekolah', 5], ['Kerapian', 'Atribut seragam tidak lengkap', 5], ['Kedisiplinan', 'Tidak mengerjakan tugas berulang', 10], ['Ketertiban', 'Membawa HP saat ujian', 15], ['Kedisiplinan', 'Bolos jam pelajaran', 20]];
  const ACHIEVEMENTS: [string, string, number][] = [['Akademik', 'Juara 2 Olimpiade Matematika tingkat kota', 30], ['Non-Akademik', 'Juara 1 Lomba Pidato Bahasa Inggris', 25], ['Non-Akademik', 'Juara 3 Futsal Antar Sekolah', 20], ['Akademik', 'Finalis Lomba Karya Tulis Ilmiah', 20], ['Non-Akademik', 'Juara 1 Robotik Tingkat Provinsi', 40]];
  for (let i = 0; i < 24; i++) {
    const s = pick(activeStudents);
    const isV = rand() < 0.55;
    const [cat, desc, pts] = pick(isV ? VIOLATIONS : ACHIEVEMENTS);
    student_records.push({ id: ++srid, student_id: s.id, type: isV ? 'pelanggaran' : 'prestasi', category: cat, description: desc, points: pts, date: addDays(TODAY, -int(1, 60)), recorded_by: kesiswaanStaff[s.unit_id].name, follow_up: isV ? pick(['Teguran lisan', 'Pembinaan wali kelas', 'Pemanggilan orang tua']) : '' });
  }
  student_records.push({ id: ++srid, student_id: demoStudent.id, type: 'prestasi', category: 'Akademik', description: 'Juara 2 Olimpiade Matematika tingkat kota', points: 30, date: addDays(TODAY, -20), recorded_by: kesiswaanStaff[3].name, follow_up: '' });
  student_records.push({ id: ++srid, student_id: demoStudent.id, type: 'pelanggaran', category: 'Kedisiplinan', description: 'Terlambat masuk sekolah', points: 5, date: addDays(TODAY, -6), recorded_by: kesiswaanStaff[3].name, follow_up: 'Teguran lisan' });

  const extracurriculars: Extracurricular[] = [
    { id: 1, unit_id: null, name: 'Pramuka', coach_id: unitTeachers[2][3].id, schedule: 'Jumat, 14.00–16.00', member_ids: activeStudents.filter((_, i) => i % 5 === 0).map((s) => s.id) },
    { id: 2, unit_id: 3, name: 'Kelompok Ilmiah Remaja', coach_id: unitTeachers[3][0].id, schedule: 'Rabu, 14.00–15.30', member_ids: activeStudents.filter((s) => s.unit_id === 3).slice(0, 12).map((s) => s.id) },
    { id: 3, unit_id: 4, name: 'Robotik', coach_id: unitTeachers[4][2].id, schedule: 'Selasa & Kamis, 14.00–16.00', member_ids: activeStudents.filter((s) => s.unit_id === 4).slice(0, 10).map((s) => s.id) },
    { id: 4, unit_id: null, name: 'Futsal', coach_id: unitTeachers[3][6].id, schedule: 'Sabtu, 08.00–10.00', member_ids: activeStudents.filter((_, i) => i % 7 === 0).map((s) => s.id) },
  ];

  const users: User[] = [
    { id: 1, username: 'admin', password: DEMO_PASSWORD, name: 'Administrator Sistem', role: 'admin', employee_id: null, student_id: null, guardian_id: null, is_active: true },
    { id: 2, username: 'kepsek', password: DEMO_PASSWORD, name: unitHeads[3].name, role: 'kepsek', employee_id: unitHeads[3].id, student_id: null, guardian_id: null, is_active: true },
    { id: 3, username: 'keuangan', password: DEMO_PASSWORD, name: bendahara.name, role: 'keuangan', employee_id: bendahara.id, student_id: null, guardian_id: null, is_active: true },
    { id: 4, username: 'kesiswaan', password: DEMO_PASSWORD, name: kesiswaanStaff[3].name, role: 'kesiswaan', employee_id: kesiswaanStaff[3].id, student_id: null, guardian_id: null, is_active: true },
    { id: 5, username: 'guru', password: DEMO_PASSWORD, name: unitTeachers[3][0].name, role: 'guru', employee_id: unitTeachers[3][0].id, student_id: null, guardian_id: null, is_active: true },
    { id: 6, username: 'siswa', password: DEMO_PASSWORD, name: demoStudent.name, role: 'siswa', employee_id: null, student_id: demoStudent.id, guardian_id: null, is_active: true },
    { id: 7, username: 'ortu', password: DEMO_PASSWORD, name: demoGuardian.name, role: 'ortu', employee_id: null, student_id: null, guardian_id: demoGuardian.id, is_active: true },
  ];

  // ---------- Riwayat akademik: kelas & rapor semester-semester sebelumnya ----------
  const enrollments: Enrollment[] = [];
  let enid = 0;
  const majorCode = (id: number | null) => majors.find((m) => m.id === id)?.code || '';
  const subjectsFor = (unitId: number, majorId: number | null) => {
    let subs = unitSubjects(unitId);
    if (majorId === 1) subs = subs.filter((x) => x.code !== 'EKO');
    if (majorId === 2) subs = subs.filter((x) => !['FIS', 'KIM'].includes(x.code));
    if (majorId === 3) subs = subs.filter((x) => x.code !== 'AKL');
    if (majorId === 4) subs = subs.filter((x) => x.code !== 'KJ');
    return subs;
  };
  const pastClassName = (st: Student, unitCode: string, level: number, majorId: number | null, currentName: string) => {
    if (unitCode === 'SD') return `${level}A`;
    if (unitCode === 'SMP') return `${roman[level]}-${currentName.slice(-1)}`;
    if (unitCode === 'SMA') return level === 10 ? `X-${(st.id % 2) + 1}` : `${roman[level]} ${majorCode(majorId)}`;
    return `${roman[level]} ${majorCode(majorId)}`;
  };
  const NOTES: [number, string][] = [
    [88, 'Prestasi belajar sangat baik. Pertahankan dan terus kembangkan potensimu.'],
    [80, 'Hasil belajar baik. Tingkatkan konsistensi dan keaktifan di kelas.'],
    [72, 'Cukup baik. Perbanyak latihan pada mata pelajaran yang belum tuntas.'],
    [0, 'Perlu meningkatkan kedisiplinan dan semangat belajar dengan bimbingan orang tua.'],
  ];
  const addHistory = (st: Student, fromLevel: number, toLevel: number, startYear: number, majorId: number | null, currentName: string, graduates: boolean) => {
    const unit = units.find((u) => u.id === st.unit_id)!;
    const current = grades.filter((g) => g.student_id === st.id).map((g) => g.final || 0);
    const ability = current.length ? current.reduce((a, b) => a + b, 0) / current.length : int(70, 88);
    const teachers = unitTeachers[unit.id];
    for (let level = fromLevel; level <= toLevel; level++) {
      const year = startYear + (level - fromLevel);
      const levelMajor = unit.code === 'SMA' && level === 10 ? null : majorId;
      const className = pastClassName(st, unit.code, level, levelMajor, currentName);
      const homeroom = teachers[(level + st.unit_id) % teachers.length].name;
      for (const semester of ['Ganjil', 'Genap'] as const) {
        const ayId = ayIdOf[`${year}-${semester}`];
        if (!ayId) continue;
        const base = ability - (toLevel + 1 - level) * 1.2 + int(-3, 3);
        const finals: number[] = [];
        for (const sub of subjectsFor(unit.id, levelMajor)) {
          const v = () => Math.min(100, Math.max(50, Math.round(base + int(-9, 9))));
          const g = { assignment: v(), daily: v(), midterm: v(), final_exam: v() };
          const final = computeFinal(g);
          finals.push(final || 0);
          grades.push({ id: grades.length + 1, student_id: st.id, subject_id: sub.id, academic_year_id: ayId, ...g, final, description: '' });
        }
        const mean = finals.reduce((a, b) => a + b, 0) / (finals.length || 1);
        const isLast = graduates && level === toLevel && semester === 'Genap';
        const result = semester === 'Genap' ? (isLast ? 'lulus' : 'naik') : null;
        const nextName = result === 'naik' ? (level + 1 === toLevel + 1 ? currentName : pastClassName(st, unit.code, level + 1, unit.code === 'SMA' && level + 1 === 10 ? null : majorId, currentName)) : '';
        enrollments.push({
          id: ++enid, student_id: st.id, academic_year_id: ayId, unit_id: unit.id, class_id: null, class_name: className, grade: level,
          homeroom_name: homeroom, sick: rand() < 0.5 ? int(1, 3) : 0, permit: rand() < 0.4 ? int(1, 2) : 0, absent: rand() < 0.12 ? 1 : 0,
          homeroom_note: NOTES.find(([min]) => mean >= min)![1], result, next_class_name: nextName,
        });
      }
    }
  };
  for (const st of students) {
    const unit = units.find((u) => u.id === st.unit_id)!;
    if (st.status === 'aktif') {
      const cls = classes.find((c) => c.id === st.class_id)!;
      if (cls.grade === unit.min_grade) continue;
      let from = unit.min_grade;
      if (st.entry_type === 'pindahan') {
        // Siswa pindahan: riwayat di sekolah ini hanya sejak masuk (1 tahun terakhir)
        from = cls.grade - 1;
        st.entry_year = 2025;
        st.origin_school = `${unit.code} Negeri ${(st.id % 9) + 1} ${CITIES[st.id % CITIES.length]}`;
      }
      addHistory(st, from, cls.grade - 1, 2026 - (cls.grade - from), cls.major_id, cls.name, false);
    } else if (st.status === 'lulus') {
      const majorId = st.unit_id === 3 ? 1 : 3;
      addHistory(st, unit.min_grade, unit.max_grade, 2023, majorId, `XII ${majorCode(majorId)}`, true);
    }
  }

  // ---------- Pengeluaran kas ----------
  const expenses: Expense[] = [];
  let exid2 = 0;
  const monthsToDate = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].filter((m) => m <= TODAY.slice(0, 7));
  for (const m of monthsToDate) {
    const d = (day: number) => `${m}-${pad(Math.min(day, m === TODAY.slice(0, 7) ? Number(TODAY.slice(8, 10)) : 28))}`;
    for (const u of units) {
      const add = (category: Expense['category'], description: string, amount: number, day: number, method: Expense['method'] = 'Transfer Bank') =>
        expenses.push({ id: ++exid2, unit_id: u.id, date: d(day), category, description, amount, method, receipt_url: '', recorded_by: 'Rina Kartika, S.E.', created_at: `${d(day)}T10:00:00` });
      if (m < TODAY.slice(0, 7) || Number(TODAY.slice(8, 10)) >= 25) add('Gaji & Honor', `Gaji & honor guru/pegawai ${u.code} ${m}`, 14_000_000 + u.id * 1_000_000 + int(0, 10) * 100_000, 25);
      add('Utilitas', `Listrik, air & internet ${u.code}`, int(25, 40) * 100_000, 5);
      add('ATK & Bahan Ajar', `ATK, kertas & tinta ${u.code}`, int(8, 18) * 100_000, 8, 'Tunai');
      if (rand() < 0.5) add('Pemeliharaan', `Perbaikan sarana ${u.code} (AC/meja/kursi)`, int(10, 35) * 100_000, 14, 'Tunai');
      if (rand() < 0.5) add('Kegiatan Siswa', `Kegiatan ekstrakurikuler & lomba ${u.code}`, int(10, 30) * 100_000, 18);
    }
    expenses.push({ id: ++exid2, unit_id: null, date: d(3), category: 'Operasional', description: 'Operasional yayasan (kebersihan & keamanan)', amount: 6_500_000, method: 'Transfer Bank', receipt_url: '', recorded_by: 'Rina Kartika, S.E.', created_at: `${d(3)}T09:00:00` });
  }

  // ---------- Pengajuan izin/sakit dari orang tua ----------
  const leave_requests: LeaveRequest[] = [];
  let lrid = 0;
  const nextSchoolDay = (() => { let x = addDays(TODAY, 1); while (isWeekend(x)) x = addDays(x, 1); return x; })();
  leave_requests.push({ id: ++lrid, student_id: demoStudent.id, user_id: 7, submitted_by: demoGuardian.name, type: 'S', start_date: schoolDays[schoolDays.length - 9], end_date: schoolDays[schoolDays.length - 8], reason: 'Demam dan flu, istirahat sesuai anjuran dokter.', attachment_url: '', status: 'disetujui', reviewed_by: unitTeachers[3][0].name, review_note: 'Semoga lekas sembuh.', reviewed_at: `${schoolDays[schoolDays.length - 9]}T08:10:00`, created_at: `${schoolDays[schoolDays.length - 9]}T06:30:00` });
  leave_requests.push({ id: ++lrid, student_id: demoStudent.id, user_id: 7, submitted_by: demoGuardian.name, type: 'I', start_date: nextSchoolDay, end_date: nextSchoolDay, reason: 'Menghadiri acara pernikahan keluarga di luar kota.', attachment_url: '', status: 'menunggu', reviewed_by: '', review_note: '', reviewed_at: null, created_at: `${TODAY}T07:15:00` });
  const classmate = activeStudents.find((x) => x.class_id === demoClass.id && x.id !== demoStudent.id)!;
  leave_requests.push({ id: ++lrid, student_id: classmate.id, user_id: 0, submitted_by: guardians.find((g) => g.id === classmate.guardian_id)!.name, type: 'S', start_date: nextSchoolDay, end_date: addDays(nextSchoolDay, 1), reason: 'Sakit gigi, jadwal kontrol ke dokter gigi.', attachment_url: '', status: 'menunggu', reviewed_by: '', review_note: '', reviewed_at: null, created_at: `${TODAY}T06:50:00` });
  for (let i = 0; i < 8; i++) {
    const st = pick(activeStudents);
    const day = schoolDays[int(0, schoolDays.length - 3)];
    const approved = rand() < 0.85;
    leave_requests.push({ id: ++lrid, student_id: st.id, user_id: 0, submitted_by: guardians.find((g) => g.id === st.guardian_id)?.name || 'Orang tua', type: rand() < 0.6 ? 'S' : 'I', start_date: day, end_date: day, reason: pick(['Sakit demam', 'Keperluan keluarga', 'Kontrol ke dokter', 'Sakit perut']), attachment_url: '', status: approved ? 'disetujui' : 'ditolak', reviewed_by: employees.find((e) => e.id === classes.find((c) => c.id === st.class_id)?.homeroom_id)?.name || '-', review_note: approved ? '' : 'Mohon lampirkan surat keterangan.', reviewed_at: `${day}T09:00:00`, created_at: `${day}T06:30:00` });
  }

  // ---------- Jurnal mengajar ----------
  const teaching_journals: TeachingJournal[] = [];
  let tjid = 0;
  const demoTeacherId = unitTeachers[3][0].id;
  const TOPICS = ['Pembahasan konsep dasar', 'Latihan soal & diskusi kelompok', 'Presentasi hasil kerja kelompok', 'Pembahasan tugas & remedial', 'Penerapan konsep pada kasus nyata', 'Ulangan harian & pembahasan'];
  for (const day of schoolDays.slice(-10)) {
    if (day === TODAY) continue;
    const dow = new Date(day + 'T00:00:00').getDay();
    for (const sc of schedules.filter((x) => x.day === dow)) {
      const isDemo = sc.teacher_id === demoTeacherId;
      if (!isDemo && (day < schoolDays[schoolDays.length - 6] || rand() > 0.7)) continue;
      const att = student_attendance.filter((a) => a.class_id === sc.class_id && a.date === day);
      const sub = subjects.find((x) => x.id === sc.subject_id)!;
      teaching_journals.push({
        id: ++tjid, teacher_id: sc.teacher_id, class_id: sc.class_id, subject_id: sc.subject_id, date: day, start_time: sc.start_time,
        topic: `${sub.name}: ${pick(TOPICS)}`, activities: 'Apersepsi, penjelasan materi, latihan terbimbing, refleksi.',
        notes: rand() < 0.2 ? 'Beberapa siswa perlu pendampingan tambahan.' : '', present: att.filter((a) => a.status === 'H').length, absent: att.filter((a) => a.status !== 'H').length,
        created_at: `${day}T${sc.end_time}:00`,
      });
    }
  }

  // ---------- Perpustakaan ----------
  const librarian = addEmp({ name: 'Dewi Sartika, S.IP.', gender: 'P', unit_id: null, type: 'tendik', position: 'Kepala Perpustakaan', status: 'PTY', education: 'S1', supervisor_id: ketua.id });
  const BOOKS: [Book['category'], string, string, string, number | null, number, number | null][] = [
    // kategori, judul, pengarang, penerbit, tahun, eksemplar, unit
    ['Fiksi', 'Laskar Pelangi', 'Andrea Hirata', 'Bentang Pustaka', 2005, 5, null],
    ['Fiksi', 'Sang Pemimpi', 'Andrea Hirata', 'Bentang Pustaka', 2006, 3, null],
    ['Fiksi', 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Hasta Mitra', 1980, 3, null],
    ['Fiksi', 'Negeri 5 Menara', 'Ahmad Fuadi', 'Gramedia Pustaka Utama', 2009, 4, null],
    ['Fiksi', 'Ronggeng Dukuh Paruk', 'Ahmad Tohari', 'Gramedia Pustaka Utama', 1982, 2, null],
    ['Fiksi', 'Bumi', 'Tere Liye', 'Gramedia Pustaka Utama', 2014, 4, null],
    ['Fiksi', 'Hujan', 'Tere Liye', 'Gramedia Pustaka Utama', 2016, 3, null],
    ['Fiksi', 'Laut Bercerita', 'Leila S. Chudori', 'Kepustakaan Populer Gramedia', 2017, 3, null],
    ['Fiksi', 'Ayat-Ayat Cinta', 'Habiburrahman El Shirazy', 'Republika', 2004, 2, null],
    ['Fiksi', 'Dilan: Dia adalah Dilanku Tahun 1990', 'Pidi Baiq', 'Pastel Books', 2014, 3, null],
    ['Nonfiksi', 'Filosofi Teras', 'Henry Manampiring', 'Penerbit Buku Kompas', 2018, 3, null],
    ['Nonfiksi', 'Atomic Habits (terjemahan)', 'James Clear', 'Gramedia Pustaka Utama', 2019, 3, null],
    ['Nonfiksi', 'Sapiens: Riwayat Singkat Umat Manusia (terjemahan)', 'Yuval Noah Harari', 'Kepustakaan Populer Gramedia', 2017, 2, null],
    ['Nonfiksi', 'Sejarah Indonesia Modern 1200–2008 (terjemahan)', 'M.C. Ricklefs', 'Serambi', 2008, 2, null],
    ['Referensi', 'Kamus Besar Bahasa Indonesia', 'Badan Pengembangan dan Pembinaan Bahasa', 'Balai Pustaka', null, 4, null],
    ['Referensi', 'Atlas Indonesia dan Dunia', 'Tim Penyusun', '-', null, 6, null],
    ['Referensi', 'Ensiklopedia Sains untuk Pelajar', 'Tim Penyusun', '-', null, 2, null],
    ['Majalah', 'Majalah Bobo (bundel semester)', 'Redaksi Bobo', 'Kompas Gramedia', null, 4, 1],
    ['Buku Anak', 'Kumpulan Dongeng Nusantara', 'Tim Penyusun', '-', null, 5, 1],
    ['Buku Anak', 'Si Kancil dan Buaya', 'Cerita Rakyat', '-', null, 4, 1],
    ['Buku Pelajaran', 'Buku Siswa Bahasa Indonesia Kelas III SD (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 12, 1],
    ['Buku Pelajaran', 'Buku Siswa IPAS Kelas V SD (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 12, 1],
    ['Buku Pelajaran', 'Buku Siswa Informatika Kelas VII SMP (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2021, 15, 2],
    ['Buku Pelajaran', 'Buku Siswa IPA Kelas VIII SMP (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 15, 2],
    ['Buku Pelajaran', 'Buku Siswa Matematika Kelas XI SMA (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 20, 3],
    ['Buku Pelajaran', 'Buku Siswa Fisika Kelas XI SMA (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 16, 3],
    ['Buku Pelajaran', 'Buku Siswa Bahasa Inggris Kelas X SMA/SMK (Kurikulum Merdeka)', 'Kemendikbudristek', 'Pusat Perbukuan', 2021, 20, null],
    ['Buku Pelajaran', 'Dasar-dasar Teknik Jaringan Komputer dan Telekomunikasi Kelas X SMK', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 12, 4],
    ['Buku Pelajaran', 'Dasar-dasar Akuntansi dan Keuangan Lembaga Kelas X SMK', 'Kemendikbudristek', 'Pusat Perbukuan', 2022, 12, 4],
  ];
  const PREFIX: Record<string, string> = { Fiksi: 'FIK', Nonfiksi: 'NON', 'Buku Pelajaran': 'PEL', Referensi: 'REF', Majalah: 'MAJ', 'Buku Anak': 'ANK' };
  const counters: Record<string, number> = {};
  const books: Book[] = BOOKS.map(([category, title, author, publisher, year, copies, unit_id], i) => {
    counters[category] = (counters[category] || 0) + 1;
    return {
      id: i + 1, unit_id, code: `${PREFIX[category]}-${pad(counters[category], 3)}`, isbn: '', title, author, publisher, year, category,
      location: `Rak ${String.fromCharCode(65 + (i % 6))}${(i % 4) + 1}`, copies, cover_url: '',
      description: category === 'Buku Pelajaran' ? 'Buku teks utama untuk kegiatan belajar di kelas.' : '', created_at: '2026-07-01T08:00:00',
    };
  });
  const book_loans: BookLoan[] = [];
  const book_reservations: BookReservation[] = [];
  const onLoan = new Map<number, number>();
  let blid = 0;
  const addLoan = (book: Book, who: { student_id?: number; employee_id?: number }, borrowed: string, returnedOffset: number | null) => {
    const active = returnedOffset === null;
    if (active && (onLoan.get(book.id) || 0) >= book.copies) return;
    const due = addDays(borrowed, 7);
    const returned = active ? null : addDays(due, returnedOffset!);
    const lateDays = returned && returned > due ? Math.round((new Date(returned).getTime() - new Date(due).getTime()) / 86400000) : 0;
    book_loans.push({ id: ++blid, book_id: book.id, student_id: who.student_id ?? null, employee_id: who.employee_id ?? null, borrowed_at: borrowed, due_date: due, returned_at: returned && returned <= TODAY ? returned : active ? null : TODAY, extended: false, fine: lateDays * 500, fine_paid: lateDays ? rand() < 0.8 : false, bill_id: null, processed_by: librarian.name, notes: '' });
    if (active) onLoan.set(book.id, (onLoan.get(book.id) || 0) + 1);
  };
  const leisure = books.filter((b) => b.category !== 'Buku Pelajaran');
  for (let i = 0; i < 140; i++) {
    const borrowed = addDays(TODAY, -int(2, 60));
    const byStudent = rand() < 0.85;
    const st = pick(activeStudents);
    const pool = byStudent ? leisure.filter((b) => !b.unit_id || b.unit_id === st.unit_id) : books;
    const book = pick(pool);
    const who = byStudent ? { student_id: st.id } : { employee_id: pick(employees.filter((e) => e.type === 'guru')).id };
    const due = addDays(borrowed, 7);
    const active = due >= addDays(TODAY, -6) && rand() < 0.35;
    addLoan(book, who, borrowed, active ? null : int(-5, rand() < 0.2 ? 6 : 0));
  }
  // Pinjaman akun demo
  const bk = (t: string) => books.find((b) => b.title === t)!;
  addLoan(bk('Laskar Pelangi'), { student_id: demoStudent.id }, addDays(TODAY, -5), null);
  addLoan(bk('Filosofi Teras'), { student_id: demoStudent.id }, addDays(TODAY, -30), -2);
  addLoan(bk('Negeri 5 Menara'), { student_id: demoStudent.id }, addDays(TODAY, -45), 2);
  addLoan(bk('Kumpulan Dongeng Nusantara'), { student_id: sibling.id }, addDays(TODAY, -10), null); // terlambat
  addLoan(bk('Sapiens: Riwayat Singkat Umat Manusia (terjemahan)'), { employee_id: unitTeachers[3][0].id }, addDays(TODAY, -3), null);
  book_loans.sort((a, b) => a.borrowed_at.localeCompare(b.borrowed_at)).forEach((l, i) => (l.id = i + 1));
  // Denda keterlambatan siswa tercatat di keuangan: tagihan "Denda Perpustakaan" (+ pembayaran bila sudah dibayar)
  const fineFee: FeeType = { id: fee_types.length + 1, unit_id: null, name: 'Denda Perpustakaan', category: 'denda', amount: 0, description: 'Denda keterlambatan pengembalian buku (nominal sesuai hari keterlambatan)' };
  fee_types.push(fineFee);
  for (const l of book_loans.filter((x) => x.student_id && x.fine > 0)) {
    const title = books.find((b) => b.id === l.book_id)!.title;
    const bill: Bill = { id: bills.length + 1, student_id: l.student_id, applicant_id: null, fee_type_id: fineFee.id, period: l.returned_at!.slice(0, 7), description: `Denda perpustakaan: ${title}`, amount: l.fine, discount: 0, paid_amount: 0, due_date: addDays(l.returned_at!, 7), status: 'belum', created_at: `${l.returned_at}T10:00:00` };
    bills.push(bill);
    l.bill_id = bill.id;
    if (l.fine_paid) {
      payments.push({ id: payments.length + 1, bill_id: bill.id, student_id: l.student_id, applicant_id: null, amount: l.fine, method: 'Tunai', receipt_no: `KW/${l.returned_at!.slice(0, 7).replace('-', '')}/${pad(80000 + payments.length, 5)}`, paid_at: `${l.returned_at}T10:05:00`, received_by: librarian.name, note: 'Denda perpustakaan' });
      bill.paid_amount = l.fine;
      bill.status = 'lunas';
    }
  }
  users.push({ id: 8, username: 'pustakawan', password: DEMO_PASSWORD, name: librarian.name, role: 'pustakawan', employee_id: librarian.id, student_id: null, guardian_id: null, is_active: true });
  book_reservations.push(
    { id: 1, book_id: bk('Bumi').id, student_id: demoStudent.id, employee_id: null, user_id: 6, status: 'menunggu', created_at: `${addDays(TODAY, -1)}T19:30:00` },
    { id: 2, book_id: bk('Laut Bercerita').id, student_id: pick(activeStudents.filter((x) => x.unit_id >= 3)).id, employee_id: null, user_id: 0, status: 'menunggu', created_at: `${TODAY}T07:10:00` },
    { id: 3, book_id: bk('Hujan').id, student_id: pick(activeStudents).id, employee_id: null, user_id: 0, status: 'dipinjam', created_at: `${addDays(TODAY, -12)}T10:00:00` },
  );

  // ---------- Kartu ujian ----------
  const ptsFeeIds = fee_types.filter((f) => f.name.startsWith('Ujian Tengah Semester')).map((f) => f.id);
  const exam_periods: ExamPeriod[] = [
    { id: 1, name: 'Penilaian Tengah Semester (PTS) Ganjil 2026/2027', type: 'PTS', academic_year_id: AY, unit_id: null, start_date: TODAY, end_date: addDays(TODAY, 10), spp_until: '2026-09', required_fee_type_ids: ptsFeeIds, is_active: true, notes: 'Kartu ujian wajib ditunjukkan kepada pengawas sebelum ujian dimulai.' },
  ];
  const settle = (b: Bill) => {
    const rest = b.amount - b.discount - b.paid_amount;
    if (rest <= 0) return;
    payments.push({ id: payments.length + 1, bill_id: b.id, student_id: b.student_id, applicant_id: null, amount: rest, method: 'Virtual Account', receipt_no: `KW/202609/${pad(90000 + payments.length, 5)}`, paid_at: `${addDays(TODAY, -3)}T09:00:00`, received_by: 'Pembayaran Online', note: '' });
    b.paid_amount += rest;
    b.status = 'lunas';
  };
  const sppIds = new Set(fee_types.filter((f) => f.category === 'bulanan').map((f) => f.id));
  // Anak SMP akun ortu: memenuhi semua syarat
  bills.filter((b) => b.student_id === sibling.id && ((sppIds.has(b.fee_type_id) && b.period <= '2026-09') || ptsFeeIds.includes(b.fee_type_id))).forEach(settle);
  // Akun siswa demo: biaya PTS lunas, tetapi SPP September belum -> kartu belum terbit
  bills.filter((b) => b.student_id === demoStudent.id && (ptsFeeIds.includes(b.fee_type_id) || (sppIds.has(b.fee_type_id) && b.period < '2026-09'))).forEach(settle);
  const sept = bills.find((b) => b.student_id === demoStudent.id && sppIds.has(b.fee_type_id) && b.period === '2026-09')!;
  for (let i = payments.length - 1; i >= 0; i--) if (payments[i].bill_id === sept.id) payments.splice(i, 1);
  sept.paid_amount = 0;
  sept.status = 'belum';
  payments.forEach((p, i) => (p.id = i + 1));

  // ---------- Status verifikasi pembayaran ----------
  const allPayments: Payment[] = payments.map((p) => ({ ...p, status: 'terverifikasi', reference: '', proof_url: '', verified_by: p.received_by === 'Pembayaran Online' || p.received_by === 'Sistem PPDB' ? bendahara.name : p.received_by, verified_at: p.paid_at, reject_reason: '' }));
  // Contoh pembayaran online yang menunggu verifikasi bagian keuangan
  const sppIdSet = new Set(fee_types.filter((f) => f.category === 'bulanan').map((f) => f.id));
  const waiting = bills.filter((b) => b.student_id && b.student_id !== demoStudent.id && b.student_id !== sibling.id && sppIdSet.has(b.fee_type_id) && b.status === 'belum' && b.period === '2026-09').slice(0, 4);
  waiting.forEach((b, i) => {
    const method: Payment['method'] = i % 2 ? 'QRIS' : 'Transfer Bank';
    allPayments.push({ id: allPayments.length + 1, bill_id: b.id, student_id: b.student_id, applicant_id: null, amount: b.amount - b.discount, method, receipt_no: null, paid_at: `${addDays(TODAY, -(i % 2))}T${pad(19 + i)}:1${i}:00`, received_by: 'Pembayaran Online', note: 'Pembayaran SPP September', status: 'menunggu', reference: method === 'QRIS' ? `QR${900000 + i * 77}` : `TRF-BSI-${20260900 + i * 13}`, proof_url: 'https://drive.google.com/file/d/contoh-bukti-transfer/view', verified_by: '', verified_at: null, reject_reason: '' });
  });

  // ---------- Susulan & remedial (skenario akun siswa demo) ----------
  const exam_windows: ExamWindow[] = [];
  const demoUH = (code: string) => exams.find((e) => e.class_id === demoClass.id && e.type === 'UH' && e.date < TODAY && subjects.find((x) => x.id === e.subject_id)?.code === code)!;
  const missed = demoUH('INF');
  const idx = exam_results.findIndex((r) => r.exam_id === missed.id && r.student_id === demoStudent.id);
  if (idx >= 0) exam_results.splice(idx, 1);
  exam_windows.push({ id: 1, exam_id: missed.id, kind: 'susulan', date: TODAY, start_time: '00:00', end_time: '23:59', student_ids: [demoStudent.id], notes: 'Susulan karena sakit saat ulangan', created_by: unitTeachers[3][0].name, created_at: `${addDays(TODAY, -1)}T14:00:00` });
  const lowEx = demoUH('BIG');
  const low = exam_results.find((r) => r.exam_id === lowEx.id && r.student_id === demoStudent.id)!;
  low.score = 60;
  const belowKkm = exam_results.filter((r) => r.exam_id === lowEx.id && r.score < 75).map((r) => r.student_id);
  exam_windows.push({ id: 2, exam_id: lowEx.id, kind: 'remedial', date: TODAY, start_time: '00:00', end_time: '23:59', student_ids: [...new Set([demoStudent.id, ...belowKkm])], notes: 'Remedial untuk nilai di bawah KKTP', created_by: employees.find((e) => e.id === lowEx.teacher_id)!.name, created_at: `${addDays(TODAY, -1)}T14:30:00` });

  return {
    settings: [{
      id: 1, name: 'Yayasan Pendidikan Nusantara Cendekia', foundation: 'Yayasan Nusantara Cendekia', address: 'Jl. Pendidikan No. 1-5, Kebayoran Baru, Jakarta Selatan 12110',
      phone: '(021) 555-0123', email: 'info@nusantaracendekia.sch.id', website: 'www.nusantaracendekia.sch.id',
      vision: 'Menjadi lembaga pendidikan unggul yang melahirkan generasi berakhlak mulia, cerdas, kreatif, dan berdaya saing global.',
      mission: 'Menyelenggarakan pembelajaran berpusat pada siswa\nMenanamkan nilai karakter dan Profil Pelajar Pancasila\nMengembangkan literasi, numerasi, dan teknologi\nMembangun kemitraan dengan orang tua, masyarakat, dan dunia industri',
      ppdb_open: true, library_loan_days: 7, library_max_loans: 3, library_fine_per_day: 500,
    }],
    units, academic_years, users, employees, majors, subjects, classes, guardians, students, schedules,
    student_attendance, employee_attendance, materials, assignments, submissions, exams, exam_results, grades,
    fee_types, bills, payments: allPayments, applicants, announcements, events, student_records, promotions: [], extracurriculars,
    lessons, lesson_progress, virtual_classes, discussions, enrollments,
    expenses, leave_requests, teaching_journals, books, book_loans, book_reservations,
    exam_periods, exam_dispensations: [], exam_checkins: [], exam_windows, exam_attempts: [],
  };
}

export const SEED_VERSION = 5;
