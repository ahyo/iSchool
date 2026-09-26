# iSchool — Sistem Informasi Sekolah Terpadu

Sistem informasi sekolah untuk **SD, SMP, SMA, dan SMK** (satu yayasan multi-unit maupun sekolah tunggal):
portal sekolah, PPDB & mutasi, keuangan, presensi, pembelajaran daring (LMS + CBT), nilai & rapor,
kenaikan kelas & kelulusan, kesiswaan, serta kepegawaian — dengan dashboard untuk setiap peran.

- **Frontend**: Next.js 15 (App Router, static export) + Tailwind CSS + Recharts
- **Backend**: FastAPI + SQLAlchemy 2 + PostgreSQL, autentikasi JWT, kontrol akses per peran
- **Demo**: GitHub Pages — berjalan penuh di browser tanpa server (data disimpan di `localStorage`)

## Akun demo

Di halaman login tersedia tombol masuk cepat. Semua akun memakai password `demo123`.

| Username | Peran | Yang bisa dicoba |
|---|---|---|
| `admin` | Administrator | Semua modul, pengaturan, akun, reset data demo |
| `kepsek` | Kepala Sekolah | Dashboard monitoring, laporan keuangan, kenaikan/kelulusan |
| `keuangan` | Bagian Keuangan | Generate tagihan massal, terima pembayaran & cetak kwitansi, laporan |
| `kesiswaan` | Bagian Kesiswaan | Verifikasi PPDB → daftar ulang, mutasi, prestasi/pelanggaran |
| `guru` | Guru (wali kelas XI MIPA) | Presensi mandiri & kelas, e-learning (buat pelajaran, kelas virtual, progres), tugas, ujian CBT, nilai, rapor |
| `siswa` | Siswa XI MIPA | Belajar di E-Learning (kuis, kelas virtual hari ini, diskusi), CBT hari ini, tugas, tagihan, rapor |
| `pustakawan` | Pustakawan | Catat peminjaman & pengembalian (denda otomatis), proses reservasi, kelola katalog, laporan |
| `ortu` | Orang tua (2 anak: SMA & SMP) | Pantau nilai, kehadiran, tugas, dan bayar tagihan tiap anak |

## Fitur per modul

| Modul | Fitur |
|---|---|
| Portal sekolah | Profil & visi-misi, jenjang/unit & jurusan, berita/pengumuman publik, agenda, statistik |
| PPDB & mutasi | Formulir online siswa baru & pindahan (multi-langkah), nomor pendaftaran, cek status, pembayaran biaya daftar, verifikasi & seleksi, daftar ulang otomatis (membuat data siswa, akun siswa & ortu, tagihan uang pangkal), mutasi keluar |
| Keuangan | Master jenis biaya (SPP bulanan, pendaftaran, uang pangkal, ujian, kegiatan, lainnya), generate tagihan massal per unit/kelas (idempoten), tagihan perorangan, potongan/beasiswa, cicilan, pembayaran tunai/transfer/VA/QRIS, kwitansi + terbilang, pembayaran online oleh siswa/ortu, laporan penerimaan & piutang, pencatatan pengeluaran & laporan arus kas (penerimaan vs pengeluaran, saldo), ekspor CSV |
| Presensi | Presensi siswa harian per kelas (H/S/I/A) + rekap bulanan; presensi guru & pegawai check-in/out dengan deteksi terlambat + rekap |
| Akademik | Tahun ajaran & semester, kelas/rombel & wali kelas, mata pelajaran & KKTP, jadwal pelajaran (per kelas/per guru, cek bentrok) |
| Pembelajaran | Materi pelajaran, tugas (pengumpulan, penilaian, umpan balik), ujian & CBT pilihan ganda dengan timer dan penilaian otomatis |
| E-Learning | Kelas online per mapel-kelas: modul & pelajaran bertahap (bacaan, video YouTube/Vimeo/Drive/MP4, dokumen, kuis dengan nilai otomatis & bisa diulang), draf/publikasi, pelacakan progres per siswa (+ ekspor CSV), kelas virtual (Jitsi/Meet/Zoom/Teams) dengan pencatatan kehadiran & rekaman, forum diskusi (topik, balasan, sematkan, moderasi), dipantau orang tua |
| Nilai & rapor | Input nilai (tugas, harian, PTS, PAS → nilai akhir berbobot), leger kelas + ranking, rapor siap cetak untuk semester mana pun |
| Kartu ujian | Periode ujian (PTS/PAS/US/UKK) dengan syarat SPP lunas s.d. bulan tertentu & biaya ujian lunas; kartu peserta ber-QR terbit otomatis setelah syarat terpenuhi (atau dispensasi dari keuangan), bisa dicetak per siswa/per kelas; CBT ujian terkait terkunci bila kartu belum terbit; guru pengawas memverifikasi dengan kamera (pindai QR) atau NIS, kelayakan dicek ulang langsung, QR bertanda tangan HMAC sehingga tidak bisa dipalsukan, daftar hadir ujian per ruang |
| Perpustakaan | Peran Pustakawan: katalog (sampul, eksemplar, lokasi rak, stok tersedia), sirkulasi pinjam–kembali–perpanjang, denda keterlambatan otomatis, aturan pinjam (lama, batas, blokir bila terlambat/berdenda), reservasi online oleh siswa/guru, "Pinjaman Saya" untuk siswa/guru/orang tua, laporan (buku terpopuler, pembaca teraktif), impor katalog dari Excel |
| Impor data | Impor massal dari Excel/CSV: siswa (+ akun siswa & orang tua otomatis), guru & pegawai, riwayat kelas, dan nilai rapor lama; template Excel dengan petunjuk & referensi kode, pratinjau validasi per baris, upsert (impor ulang = perbarui), unduh daftar error |
| Izin & sakit online | Orang tua/siswa mengajukan izin atau sakit, wali kelas menyetujui/menolak; presensi otomatis terisi saat disetujui |
| Jurnal mengajar | Guru mengisi materi & kegiatan per sesi (terisi otomatis dari jadwal & presensi), kepala sekolah memantau keterisian per guru |
| Notifikasi | Lonceng notifikasi per peran: tagihan jatuh tempo, tenggat tugas, ujian & kelas virtual hari ini, izin menunggu, presensi/jurnal belum diisi, pendaftar baru, pengumuman |
| Akun | Profil saya & ganti password untuk semua peran |
| Riwayat akademik | Linimasa kelas siswa dari tahun ke tahun (kelas & wali kelas saat itu, keputusan naik/lulus), tren nilai per semester, rapor setiap semester lampau yang bisa dicetak; arsip semester otomatis saat kenaikan kelas + tombol "Arsipkan Rapor" di Pengaturan |
| Kenaikan & kelulusan | Rekomendasi otomatis (nilai < KKTP, kehadiran, poin pelanggaran), keputusan naik/tinggal/lulus, riwayat |
| Kesiswaan | Prestasi, pelanggaran (poin), konseling, ekstrakurikuler |
| Kepegawaian | Data guru & tenaga kependidikan, status kepegawaian, struktur organisasi (bagan) |
| Dashboard | Khusus per peran: admin, kepala sekolah, keuangan, kesiswaan, guru, siswa, orang tua |

## Struktur repositori

```
frontend/   Next.js — UI semua peran; mode DEMO (localStorage) atau LIVE (FastAPI)
  src/lib/api.ts            API client dua mode (kontrak REST yang sama)
  src/lib/demo/             seed data contoh + aksi bisnis versi browser
backend/    FastAPI + PostgreSQL
  app/models.py             skema database (nama kolom = tipe frontend)
  app/routers/crud.py       REST generik + scoping data siswa/ortu
  app/routers/actions.py    aksi bisnis (PPDB, pembayaran, presensi, CBT, nilai, kenaikan)
  tests/                    pytest (auth, hak akses, alur bisnis)
```

## Menjalankan

### 1. Mode demo (tanpa backend)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### 2. Mode live (FastAPI + PostgreSQL)

```bash
# Backend — dengan Docker
docker compose up -d                 # API di http://localhost:8000, dokumentasi di /docs

# atau manual
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # atur DATABASE_URL & SECRET_KEY
python -m app.seed                   # buat tabel + data contoh (--reset untuk mengulang)
uvicorn app.main:app --reload

# Frontend terhubung ke backend
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Pastikan `CORS_ORIGINS` di backend berisi alamat frontend.

### Tes backend

```bash
cd backend
pip install -r requirements-dev.txt
createdb ischool_test
TEST_DATABASE_URL=postgresql+psycopg://localhost/ischool_test pytest -q
```

## Kontrak API

Frontend memakai kontrak yang sama di kedua mode:

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/auth/login` | `{username, password}` → `{access_token, user}` |
| `GET` | `/api/{resource}?kolom=nilai` | daftar data + filter |
| `POST` | `/api/{resource}` | tambah data |
| `GET/PATCH/DELETE` | `/api/{resource}/{id}` | detail / ubah / hapus |
| `POST` | `/api/actions/{nama}` | aksi bisnis, mis. `ppdb.enroll`, `payments.pay`, `exams.submit`, `elearning.complete`, `discussions.post` |

Hak akses: siswa & orang tua hanya dapat membaca data miliknya sendiri (tagihan, nilai, presensi, dll.),
kunci jawaban ujian & kuis tidak dikirim ke siswa, draf pelajaran tidak terlihat oleh siswa, dan setiap resource memiliki daftar peran yang boleh menulis.

## Deploy demo ke GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` membangun frontend (mode demo) dan mempublikasikannya
setiap ada push ke `main`. Aktifkan di **Settings → Pages → Source: GitHub Actions**.

## Catatan untuk produksi

- Mode demo menyimpan data di browser masing-masing pengunjung, sehingga data tidak dibagikan antar pengguna.
  Untuk pemakaian nyata gunakan mode live.
- Pembayaran online (VA/QRIS) masih disimulasikan. Integrasikan payment gateway (mis. Midtrans/Xendit)
  pada `ppdb.pay`/`payments.pay` dengan verifikasi callback di backend.
- Unggah berkas (dokumen PPDB, lampiran tugas) belum disimpan; tambahkan object storage (S3/MinIO).
- Gunakan migrasi skema (mis. Alembic) sebelum mengubah struktur tabel di lingkungan produksi.
