/** Spesifikasi kolom impor data (dipakai template Excel, validasi demo, dan dokumentasi). */
export type ImportKind = 'siswa' | 'pegawai' | 'riwayat_kelas' | 'nilai';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  hint: string;
  example: string | number;
}

export interface ImportSpec {
  kind: ImportKind;
  title: string;
  description: string;
  keyInfo: string;
  columns: ImportColumn[];
  example2?: (string | number)[];
}

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  siswa: {
    kind: 'siswa',
    title: 'Data Siswa',
    description: 'Siswa aktif maupun alumni beserta data orang tua. Akun login siswa (username = NIS) dan orang tua (username = No. HP) dibuat otomatis dengan password awal demo123.',
    keyInfo: 'Baris dengan NIS yang sudah ada akan memperbarui data siswa tersebut.',
    columns: [
      { key: 'nis', label: 'NIS', required: true, hint: 'Nomor Induk Siswa (unik)', example: '2410099' },
      { key: 'nisn', label: 'NISN', hint: '10 digit', example: '0091234567' },
      { key: 'nama', label: 'Nama', required: true, hint: 'Nama lengkap', example: 'Budi Santoso' },
      { key: 'jk', label: 'JK', required: true, hint: 'L atau P', example: 'L' },
      { key: 'tempat_lahir', label: 'Tempat Lahir', hint: '', example: 'Bandung' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir', hint: 'YYYY-MM-DD atau DD/MM/YYYY', example: '2016-05-17' },
      { key: 'agama', label: 'Agama', hint: 'Islam/Kristen/Katolik/Hindu/Buddha/Konghucu', example: 'Islam' },
      { key: 'unit', label: 'Unit', required: true, hint: 'SD / SMP / SMA / SMK', example: 'SD' },
      { key: 'kelas', label: 'Kelas', hint: 'Nama rombel aktif (mis. 3A). Kosongkan untuk alumni/keluar', example: '3A' },
      { key: 'status', label: 'Status', hint: 'aktif / lulus / pindah / keluar (default aktif)', example: 'aktif' },
      { key: 'tahun_masuk', label: 'Tahun Masuk', hint: 'mis. 2024', example: 2024 },
      { key: 'jalur_masuk', label: 'Jalur Masuk', hint: 'baru / pindahan', example: 'baru' },
      { key: 'sekolah_asal', label: 'Sekolah Asal', hint: '', example: 'TK Pelita' },
      { key: 'tahun_lulus', label: 'Tahun Lulus', hint: 'Untuk alumni', example: '' },
      { key: 'nama_ortu', label: 'Nama Orang Tua', hint: '', example: 'Santoso' },
      { key: 'hubungan_ortu', label: 'Hubungan', hint: 'Ayah / Ibu / Wali', example: 'Ayah' },
      { key: 'hp_ortu', label: 'HP Orang Tua', hint: 'Menjadi username akun orang tua', example: '081234567890' },
      { key: 'email_ortu', label: 'Email Orang Tua', hint: '', example: 'santoso@mail.com' },
      { key: 'pekerjaan_ortu', label: 'Pekerjaan Orang Tua', hint: '', example: 'Wiraswasta' },
      { key: 'alamat', label: 'Alamat', hint: '', example: 'Jl. Merdeka No. 1, Bandung' },
    ],
  },
  pegawai: {
    kind: 'pegawai',
    title: 'Guru & Pegawai',
    description: 'Data kepegawaian. Untuk jenis "guru" dibuat akun login (username = NIP, password awal demo123).',
    keyInfo: 'Baris dengan NIP yang sudah ada akan memperbarui data pegawai tersebut.',
    columns: [
      { key: 'nip', label: 'NIP/NIY', required: true, hint: 'Unik', example: '198501012010011001' },
      { key: 'nama', label: 'Nama', required: true, hint: 'Beserta gelar', example: 'Siti Aminah, S.Pd.' },
      { key: 'jk', label: 'JK', hint: 'L atau P', example: 'P' },
      { key: 'unit', label: 'Unit', hint: 'SD / SMP / SMA / SMK / Yayasan', example: 'SD' },
      { key: 'jenis', label: 'Jenis', required: true, hint: 'guru / tendik / pimpinan', example: 'guru' },
      { key: 'jabatan', label: 'Jabatan', required: true, hint: '', example: 'Guru Kelas' },
      { key: 'status', label: 'Status', hint: 'PNS / PPPK / GTY / GTT / PTY / Honorer', example: 'GTY' },
      { key: 'pendidikan', label: 'Pendidikan', hint: 'SMA / D3 / S1 / S2 / S3', example: 'S1' },
      { key: 'hp', label: 'No. HP', hint: '', example: '081298765432' },
      { key: 'email', label: 'Email', hint: '', example: 'siti@sekolah.sch.id' },
      { key: 'mulai_bertugas', label: 'Mulai Bertugas', hint: 'YYYY-MM-DD', example: '2015-07-13' },
    ],
  },
  riwayat_kelas: {
    kind: 'riwayat_kelas',
    title: 'Riwayat Kelas (Rapor Lama)',
    description: 'Kelas yang pernah dijalani siswa per semester beserta wali kelas, ketidakhadiran, catatan, dan keputusan kenaikan. Tahun ajaran yang belum ada dibuat otomatis.',
    keyInfo: 'Satu baris per siswa per semester. Data NIS + tahun ajaran + semester yang sama akan diperbarui.',
    columns: [
      { key: 'nis', label: 'NIS', required: true, hint: 'Siswa harus sudah terdaftar', example: '2410099' },
      { key: 'tahun_ajaran', label: 'Tahun Ajaran', required: true, hint: 'Format 2024/2025', example: '2024/2025' },
      { key: 'semester', label: 'Semester', required: true, hint: 'Ganjil / Genap', example: 'Genap' },
      { key: 'kelas', label: 'Kelas', required: true, hint: 'Nama kelas saat itu', example: '1A' },
      { key: 'tingkat', label: 'Tingkat', required: true, hint: '1–12', example: 1 },
      { key: 'wali_kelas', label: 'Wali Kelas', hint: '', example: 'Ilham Santoso, S.Pd.' },
      { key: 'sakit', label: 'Sakit', hint: 'Jumlah hari', example: 1 },
      { key: 'izin', label: 'Izin', hint: 'Jumlah hari', example: 0 },
      { key: 'alpa', label: 'Alpa', hint: 'Jumlah hari', example: 0 },
      { key: 'catatan_wali_kelas', label: 'Catatan Wali Kelas', hint: '', example: 'Pertahankan prestasimu.' },
      { key: 'keputusan', label: 'Keputusan', hint: 'naik / tinggal / lulus (isi di semester Genap)', example: 'naik' },
      { key: 'naik_ke', label: 'Naik ke Kelas', hint: 'Nama kelas berikutnya', example: '2A' },
    ],
  },
  nilai: {
    kind: 'nilai',
    title: 'Nilai Rapor',
    description: 'Nilai per mata pelajaran per semester (format panjang: satu baris per mapel). Jika nilai akhir kosong, dihitung otomatis: 30% tugas + 20% harian + 20% PTS + 30% PAS.',
    keyInfo: 'Data NIS + tahun ajaran + semester + mapel yang sama akan diperbarui.',
    columns: [
      { key: 'nis', label: 'NIS', required: true, hint: 'Siswa harus sudah terdaftar', example: '2410099' },
      { key: 'tahun_ajaran', label: 'Tahun Ajaran', required: true, hint: 'Format 2024/2025', example: '2024/2025' },
      { key: 'semester', label: 'Semester', required: true, hint: 'Ganjil / Genap', example: 'Genap' },
      { key: 'mapel', label: 'Kode/Nama Mapel', required: true, hint: 'Kode (mis. MTK) atau nama mapel sesuai unit siswa', example: 'MTK' },
      { key: 'nilai_tugas', label: 'Nilai Tugas', hint: '0–100', example: 85 },
      { key: 'nilai_harian', label: 'Nilai Harian', hint: '0–100', example: 80 },
      { key: 'nilai_pts', label: 'Nilai PTS', hint: '0–100', example: 78 },
      { key: 'nilai_pas', label: 'Nilai PAS', hint: '0–100', example: 82 },
      { key: 'nilai_akhir', label: 'Nilai Akhir', hint: 'Opsional (0–100)', example: '' },
      { key: 'deskripsi', label: 'Deskripsi Capaian', hint: 'Opsional', example: 'Baik dalam operasi hitung.' },
    ],
  },
};

export interface ImportRowResult {
  row: number;
  label: string;
  status: 'baru' | 'perbarui' | 'error';
  errors: string[];
}

export interface ImportResult {
  total: number;
  valid: number;
  created: number;
  updated: number;
  failed: number;
  accounts: number;
  rows: ImportRowResult[];
  dry_run: boolean;
}

/** Normalisasi nama kolom: "Tanggal Lahir" -> "tanggal_lahir"; menerima label maupun key. */
export function normalizeHeader(h: string, kind: ImportKind): string {
  const k = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const col = IMPORT_SPECS[kind].columns.find((c) => c.key === k || c.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === k);
  return col ? col.key : k;
}
