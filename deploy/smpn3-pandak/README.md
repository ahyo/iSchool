# Deploy SMP Negeri 3 Pandak

Instalasi khusus SMPN 3 Pandak, Bantul (branch `smpn3-pandak`): satu unit SMP, tanpa data contoh.

| Bagian | Alamat | Di server |
| --- | --- | --- |
| Web (Next.js statis) | `web.smppandak3-bantul.sch.id` | `/var/www/smpn3pandak/web` (nginx) |
| API (FastAPI) | `api.smppandak3-bantul.sch.id` | systemd `ischool-smpn3` → `127.0.0.1:8110`, nginx proxy |
| Database | PostgreSQL 13 lokal | db & role `ischool_smpn3`, kredensial di `backend/.env` (dibuat otomatis, chmod 600) |

Lalu lintas publik masuk lewat Cloudflare Tunnel ke nginx port 80; kedua hostname perlu ditambahkan
sebagai *Public Hostname* tunnel (service `http://localhost:80`) dan DNS domain diarahkan ke Cloudflare.

## Rilis

```bash
deploy/smpn3-pandak/deploy.sh                      # lokal: build + bundel
scp deploy/smpn3-pandak/smpn3pandak-bundle.tgz deploy/smpn3-pandak/install.sh server:~
ssh server 'PGADMIN_PASSWORD=... bash install.sh'  # PGADMIN_PASSWORD hanya untuk instalasi pertama
```

Instalasi pertama membuat database, `.env` (SECRET_KEY acak), data master (`python -m app.setup_school`)
dan mencetak password awal akun `admin` — segera ganti lewat menu Profil. Rilis berikutnya hanya
memperbarui kode, menambah tabel baru bila ada, dan me-restart layanan; data tidak disentuh.

Setelah login admin: lengkapi Pengaturan › Profil Sekolah (NPSN, alamat, kontak, visi-misi, rekening),
buat kelas & rombel, lalu impor guru dan siswa lewat menu Impor Data.
