/* Impor data (mode demo). Padanan server: backend/app/importer.py */
import type { AcademicYear, Book, Employee, Student } from '../types';
import type { ImportKind, ImportResult, ImportRowResult } from '../importSpec';
import { getDB, insert, patch, commit } from './store';
import { DEMO_PASSWORD } from './seed';
import { computeFinal, nowISO } from '../utils';

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export function parseDate(v: unknown): string | null | undefined {
  const s = str(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined; // tidak valid
}

function parseScore(v: unknown, label: string, errors: string[]): number | null {
  const s = str(v).replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (isNaN(n) || n < 0 || n > 100) {
    errors.push(`${label} harus angka 0–100`);
    return null;
  }
  return n;
}

function parseCount(v: unknown, label: string, errors: string[]): number {
  const s = str(v);
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) errors.push(`${label} harus bilangan bulat ≥ 0`);
  return Math.max(0, Math.floor(n) || 0);
}

const SEMESTERS = ['Ganjil', 'Genap'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function findOrCreateYear(name: string, semester: 'Ganjil' | 'Genap', apply: boolean): AcademicYear | { id: 0; name: string; semester: string } {
  const d = getDB();
  const found = d.academic_years.find((y) => y.name === name && y.semester === semester);
  if (found || !apply) return found || { id: 0, name, semester };
  const start = Number(name.slice(0, 4));
  return insert('academic_years', {
    name, semester, is_active: false,
    start_date: semester === 'Ganjil' ? `${start}-07-13` : `${start + 1}-01-05`,
    end_date: semester === 'Ganjil' ? `${start}-12-18` : `${start + 1}-06-26`,
  });
}

function validateYear(r: Row, errors: string[]) {
  const name = str(r.tahun_ajaran).replace(/\s/g, '');
  const semester = capital(str(r.semester));
  if (!/^\d{4}\/\d{4}$/.test(name) || Number(name.slice(5)) !== Number(name.slice(0, 4)) + 1) errors.push('Tahun ajaran harus berformat 2024/2025');
  if (!SEMESTERS.includes(semester)) errors.push('Semester harus Ganjil atau Genap');
  return { name, semester: semester as 'Ganjil' | 'Genap' };
}

export function runImport(kind: ImportKind, rows: Row[], dryRun: boolean): ImportResult {
  const d = getDB();
  const results: ImportRowResult[] = [];
  let created = 0, updated = 0, accounts = 0;
  const seen = new Set<string>();
  const unitByCode = (c: string) => d.units.find((u) => u.code === c.toUpperCase());
  const studentByNis = (nis: string) => d.students.find((s) => s.nis === nis);

  rows.forEach((r, i) => {
    const errors: string[] = [];
    const rowNo = i + 2; // baris 1 = header
    let label = '';
    let status: ImportRowResult['status'] = 'baru';
    const apply = !dryRun;

    if (kind === 'siswa') {
      const nis = str(r.nis), nama = str(r.nama), jk = str(r.jk).toUpperCase();
      label = `${nis} · ${nama}`;
      if (!nis) errors.push('NIS wajib diisi');
      if (!nama) errors.push('Nama wajib diisi');
      if (!['L', 'P'].includes(jk)) errors.push('JK harus L atau P');
      const unit = unitByCode(str(r.unit));
      if (!unit) errors.push(`Unit "${str(r.unit)}" tidak dikenal (SD/SMP/SMA/SMK)`);
      const statusVal = (str(r.status).toLowerCase() || 'aktif') as Student['status'];
      if (!['aktif', 'lulus', 'pindah', 'keluar'].includes(statusVal)) errors.push('Status harus aktif/lulus/pindah/keluar');
      const kelas = str(r.kelas);
      const cls = kelas ? d.classes.find((c) => c.name.toLowerCase() === kelas.toLowerCase() && c.unit_id === unit?.id) : undefined;
      if (statusVal === 'aktif' && !cls) errors.push(kelas ? `Kelas "${kelas}" tidak ditemukan di unit ${unit?.code || '-'}` : 'Kelas wajib diisi untuk siswa aktif');
      const birth = parseDate(r.tanggal_lahir);
      if (birth === undefined) errors.push('Tanggal lahir tidak valid');
      const jalur = str(r.jalur_masuk).toLowerCase() || 'baru';
      if (!['baru', 'pindahan'].includes(jalur)) errors.push('Jalur masuk harus baru atau pindahan');
      if (seen.has(nis)) errors.push('NIS duplikat di dalam file');
      seen.add(nis);
      const existing = studentByNis(nis);
      if (existing) status = 'perbarui';
      if (!errors.length && apply) {
        const hp = str(r.hp_ortu);
        let guardianId = existing?.guardian_id ?? null;
        if (str(r.nama_ortu)) {
          const g = (guardianId && d.guardians.find((x) => x.id === guardianId)) || (hp && d.guardians.find((x) => x.phone === hp));
          const gData = { name: str(r.nama_ortu), relation: str(r.hubungan_ortu) || 'Orang Tua', phone: hp, email: str(r.email_ortu), occupation: str(r.pekerjaan_ortu), address: str(r.alamat) };
          guardianId = g ? patch('guardians', g.id, gData).id : insert('guardians', gData).id;
        }
        const data = {
          nis, nisn: str(r.nisn), name: nama, gender: jk as 'L' | 'P', birth_place: str(r.tempat_lahir), birth_date: birth || '', religion: str(r.agama) || 'Islam',
          address: str(r.alamat), class_id: statusVal === 'aktif' ? cls!.id : null, unit_id: unit!.id, guardian_id: guardianId, status: statusVal,
          entry_year: Number(str(r.tahun_masuk)) || new Date().getFullYear(), entry_type: jalur as 'baru' | 'pindahan', origin_school: str(r.sekolah_asal),
          graduation_year: Number(str(r.tahun_lulus)) || null,
        };
        const st = existing ? patch('students', existing.id, data) : insert('students', { ...data, notes: 'Impor data' } as Omit<Student, 'id'>);
        if (!d.users.some((u) => u.student_id === st.id) && !d.users.some((u) => u.username === nis)) {
          insert('users', { username: nis, password: DEMO_PASSWORD, name: nama, role: 'siswa', employee_id: null, student_id: st.id, guardian_id: null, is_active: true });
          accounts++;
        }
        if (guardianId && hp && !d.users.some((u) => u.guardian_id === guardianId) && !d.users.some((u) => u.username === hp)) {
          insert('users', { username: hp, password: DEMO_PASSWORD, name: str(r.nama_ortu), role: 'ortu', employee_id: null, student_id: null, guardian_id: guardianId, is_active: true });
          accounts++;
        }
      }
    }

    if (kind === 'pegawai') {
      const nip = str(r.nip), nama = str(r.nama), jenis = str(r.jenis).toLowerCase();
      label = `${nip} · ${nama}`;
      if (!nip) errors.push('NIP wajib diisi');
      if (!nama) errors.push('Nama wajib diisi');
      if (!['guru', 'tendik', 'pimpinan'].includes(jenis)) errors.push('Jenis harus guru/tendik/pimpinan');
      if (!str(r.jabatan)) errors.push('Jabatan wajib diisi');
      const unitStr = str(r.unit);
      const unit = unitStr && unitStr.toLowerCase() !== 'yayasan' ? unitByCode(unitStr) : null;
      if (unitStr && unitStr.toLowerCase() !== 'yayasan' && !unit) errors.push(`Unit "${unitStr}" tidak dikenal`);
      const jk = str(r.jk).toUpperCase() || 'L';
      if (!['L', 'P'].includes(jk)) errors.push('JK harus L atau P');
      const stat = str(r.status) || 'GTY';
      if (!['PNS', 'PPPK', 'GTY', 'GTT', 'PTY', 'Honorer'].includes(stat)) errors.push('Status kepegawaian tidak dikenal');
      const join = parseDate(r.mulai_bertugas);
      if (join === undefined) errors.push('Tanggal mulai bertugas tidak valid');
      if (seen.has(nip)) errors.push('NIP duplikat di dalam file');
      seen.add(nip);
      const existing = d.employees.find((e) => e.nip === nip);
      if (existing) status = 'perbarui';
      if (!errors.length && apply) {
        const data = { nip, name: nama, gender: jk as 'L' | 'P', unit_id: unit?.id ?? null, type: jenis as Employee['type'], position: str(r.jabatan), status: stat as Employee['status'], education: str(r.pendidikan) || 'S1', phone: str(r.hp), email: str(r.email), join_date: join || '' };
        const emp = existing ? patch('employees', existing.id, data) : insert('employees', { ...data, supervisor_id: unit?.head_id ?? null, is_active: true });
        if (jenis === 'guru' && !d.users.some((u) => u.employee_id === emp.id) && !d.users.some((u) => u.username === nip)) {
          insert('users', { username: nip, password: DEMO_PASSWORD, name: nama, role: 'guru', employee_id: emp.id, student_id: null, guardian_id: null, is_active: true });
          accounts++;
        }
      }
    }

    if (kind === 'buku') {
      const kode = str(r.kode), judul = str(r.judul), kategori = str(r.kategori);
      label = `${kode} · ${judul}`;
      if (!kode) errors.push('Kode buku wajib diisi');
      if (!judul) errors.push('Judul wajib diisi');
      const CATS = ['Fiksi', 'Nonfiksi', 'Buku Pelajaran', 'Referensi', 'Majalah', 'Buku Anak'];
      const cat = CATS.find((c) => c.toLowerCase() === kategori.toLowerCase());
      if (!cat) errors.push(`Kategori harus salah satu: ${CATS.join(', ')}`);
      const copies = Number(str(r.jumlah_eksemplar));
      if (!Number.isInteger(copies) || copies < 1) errors.push('Jumlah eksemplar harus bilangan bulat ≥ 1');
      const year = str(r.tahun) ? Number(str(r.tahun)) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2100)) errors.push('Tahun terbit tidak valid');
      const unitStr = str(r.unit);
      const unit = unitStr ? unitByCode(unitStr) : null;
      if (unitStr && !unit) errors.push(`Unit "${unitStr}" tidak dikenal`);
      if (seen.has(kode.toLowerCase())) errors.push('Kode buku duplikat di dalam file');
      seen.add(kode.toLowerCase());
      const existing = d.books.find((b) => b.code.toLowerCase() === kode.toLowerCase());
      if (existing) {
        status = 'perbarui';
        const onLoan = d.book_loans.filter((l) => l.book_id === existing.id && !l.returned_at).length;
        if (copies < onLoan) errors.push(`Jumlah eksemplar tidak boleh kurang dari yang sedang dipinjam (${onLoan})`);
      }
      if (!errors.length && apply) {
        const data = { code: kode, title: judul, author: str(r.pengarang), publisher: str(r.penerbit), year, isbn: str(r.isbn), category: cat as Book['category'], unit_id: unit?.id ?? null, location: str(r.lokasi_rak), copies, description: str(r.deskripsi) };
        if (existing) patch('books', existing.id, data);
        else insert('books', { ...data, cover_url: '', created_at: nowISO() });
      }
    }

    if (kind === 'riwayat_kelas' || kind === 'nilai') {
      const nis = str(r.nis);
      const st = studentByNis(nis);
      if (!nis) errors.push('NIS wajib diisi');
      else if (!st) errors.push(`Siswa dengan NIS ${nis} belum terdaftar (impor data siswa terlebih dahulu)`);
      const { name, semester } = validateYear(r, errors);
      const year = !errors.length ? findOrCreateYear(name, semester, false) : null;
      label = `${nis} · ${st?.name || '?'} · ${name} ${semester}`;

      if (kind === 'riwayat_kelas') {
        const kelas = str(r.kelas), tingkat = Number(str(r.tingkat));
        if (!kelas) errors.push('Kelas wajib diisi');
        if (!Number.isInteger(tingkat) || tingkat < 1 || tingkat > 12) errors.push('Tingkat harus 1–12');
        const sick = parseCount(r.sakit, 'Sakit', errors), permit = parseCount(r.izin, 'Izin', errors), absent = parseCount(r.alpa, 'Alpa', errors);
        const kep = str(r.keputusan).toLowerCase();
        if (kep && !['naik', 'tinggal', 'lulus'].includes(kep)) errors.push('Keputusan harus naik/tinggal/lulus');
        const key = `${nis}|${name}|${semester}`;
        if (seen.has(key)) errors.push('Baris duplikat (NIS + tahun ajaran + semester)');
        seen.add(key);
        const existing = st && year?.id ? d.enrollments.find((e) => e.student_id === st.id && e.academic_year_id === year.id) : undefined;
        if (existing) status = 'perbarui';
        if (!errors.length && apply) {
          const ay = findOrCreateYear(name, semester, true) as AcademicYear;
          const data = { student_id: st!.id, academic_year_id: ay.id, unit_id: st!.unit_id, class_id: null, class_name: kelas, grade: tingkat, homeroom_name: str(r.wali_kelas), sick, permit, absent, homeroom_note: str(r.catatan_wali_kelas), result: (kep || null) as 'naik' | null, next_class_name: str(r.naik_ke) };
          const ex = d.enrollments.find((e) => e.student_id === st!.id && e.academic_year_id === ay.id);
          if (ex) patch('enrollments', ex.id, data);
          else insert('enrollments', data);
        }
      } else {
        const mapel = str(r.mapel);
        const sub = st ? d.subjects.find((x) => x.unit_id === st.unit_id && (x.code.toLowerCase() === mapel.toLowerCase() || x.name.toLowerCase() === mapel.toLowerCase())) : undefined;
        if (!mapel) errors.push('Mapel wajib diisi');
        else if (st && !sub) errors.push(`Mapel "${mapel}" tidak ditemukan di unit siswa`);
        const g = {
          assignment: parseScore(r.nilai_tugas, 'Nilai tugas', errors), daily: parseScore(r.nilai_harian, 'Nilai harian', errors),
          midterm: parseScore(r.nilai_pts, 'Nilai PTS', errors), final_exam: parseScore(r.nilai_pas, 'Nilai PAS', errors),
        };
        const finalIn = parseScore(r.nilai_akhir, 'Nilai akhir', errors);
        const final = finalIn ?? computeFinal(g);
        if (final === null) errors.push('Isi minimal satu nilai');
        label += ` · ${sub?.code || mapel}`;
        const key = `${nis}|${name}|${semester}|${sub?.id || mapel}`;
        if (seen.has(key)) errors.push('Baris duplikat (NIS + semester + mapel)');
        seen.add(key);
        const existing = st && sub && year?.id ? d.grades.find((x) => x.student_id === st.id && x.subject_id === sub.id && x.academic_year_id === year.id) : undefined;
        if (existing) status = 'perbarui';
        if (!errors.length && apply) {
          const ay = findOrCreateYear(name, semester, true) as AcademicYear;
          const data = { student_id: st!.id, subject_id: sub!.id, academic_year_id: ay.id, ...g, final, description: str(r.deskripsi) };
          const ex = d.grades.find((x) => x.student_id === st!.id && x.subject_id === sub!.id && x.academic_year_id === ay.id);
          if (ex) patch('grades', ex.id, data);
          else insert('grades', data);
        }
      }
    }

    if (errors.length) status = 'error';
    else if (status === 'perbarui') updated++;
    else created++;
    results.push({ row: rowNo, label, status, errors });
  });

  if (!dryRun) commit();
  const failed = results.filter((x) => x.status === 'error').length;
  return { total: rows.length, valid: rows.length - failed, created, updated, failed, accounts, rows: results, dry_run: dryRun };
}
