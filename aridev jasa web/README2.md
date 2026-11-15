# Backend: admin harga dan notifikasi email

Backend ringan (Node.js, tanpa framework web, satu dependensi: `nodemailer`) untuk website paket pembuatan website.

## Fitur
- Admin masuk di `/admin/` lalu mengedit paket, harga, biaya tambahan, nomor WhatsApp, dan email penerima notifikasi.
- Website publik mengambil harga terbaru dari `GET /api/packages`. Bila backend tidak aktif, website memakai data bawaan di `frontend/js/data.js`.
- Saat pengunjung mengirim estimasi, menekan tombol chat sebuah paket, atau menekan tombol konsultasi gratis, backend menyimpan pesan, menghitung ulang estimasi di server (angka dari browser tidak dipercaya), dan mengirim email ke admin.
- Admin juga mendapat email ketika harga diubah lewat panel (dapat dimatikan).

## Menjalankan di komputer sendiri
1. Pasang Node.js 18 atau lebih baru.
2. `cd backend` lalu `npm install`.
3. Salin `.env.example` menjadi `.env`, lalu isi nilainya (lihat tabel di bawah).
4. `npm start`, kemudian buka `http://localhost:3000/admin/`.

Tanpa pengaturan SMTP, email tidak dikirim melainkan ditulis ke `data/outbox/` (mode `console`) sehingga aman untuk uji coba.

## Dua cara memasang
- **Satu alamat (paling mudah):** isi `FRONTEND_DIR=../frontend`. Website tampil di `/`, admin di `/admin/`, API di `/api/...`. `API_BASE` di `frontend/js/config.js` tetap kosong.
- **Terpisah:** website di hosting statis, backend di server lain. Isi `API_BASE` di `frontend/js/config.js` dengan alamat backend (contoh `https://api.domain-anda.com`) dan isi `CORS_ORIGIN` dengan alamat website (contoh `https://domain-anda.com`).

## Pengaturan (`.env`)
| Nama | Keterangan |
|---|---|
| `PORT` | Port server (bawaan 3000). |
| `ADMIN_USER` | Nama pengguna admin (bawaan `admin`). |
| `ADMIN_PASSWORD_HASH` | Hash kata sandi (disarankan). Buat dengan `npm run hash-password -- "kata-sandi-anda"`. |
| `ADMIN_PASSWORD` | Kata sandi polos (hanya untuk uji coba; diabaikan bila hash diisi). |
| `SESSION_SECRET` | Teks acak panjang untuk menandatangani sesi admin. Wajib diganti. |
| `NODE_ENV` | `production` membuat server menolak start tanpa kata sandi admin. |
| `CORS_ORIGIN` | Alamat website yang boleh memanggil API (bawaan `*`). |
| `TRUST_PROXY` | `true` bila di belakang proxy agar IP asli terbaca untuk pembatasan laju. |
| `FRONTEND_DIR` | Folder frontend bila ingin disajikan oleh backend. |
| `ADMIN_EMAIL` | Email penerima awal; dapat diubah di tab Pengaturan. |
| `MAIL_MODE` | `smtp`, `console` (tulis ke `data/outbox`), atau `off`. |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Pengaturan SMTP penyedia email Anda. |

Contoh SMTP: Gmail memakai `smtp.gmail.com`, port 587, `SMTP_SECURE=false`, dan **kata sandi aplikasi** (bukan kata sandi akun). Layanan seperti Brevo atau Mailgun juga dapat dipakai. Setelah mengisi, buka tab Pengaturan lalu tekan “Kirim email tes”.

## API
| Metode dan alamat | Akses | Fungsi |
|---|---|---|
| `GET /api/packages` | publik | Paket, harga, biaya tambahan, dan nomor WhatsApp. |
| `POST /api/inquiries` | publik (maks. 30 per jam per IP) | Mencatat pesan masuk dan mengirim email. |
| `POST /api/admin/login` | publik (maks. 8 per 15 menit per IP) | Menukar nama pengguna dan kata sandi dengan token sesi 8 jam. |
| `GET` dan `PUT /api/admin/data` | admin | Membaca dan menyimpan seluruh data yang dapat diedit. |
| `GET /api/admin/inquiries` | admin | 100 pesan masuk terbaru. |
| `POST /api/admin/test-email` | admin | Mengirim email tes. |
| `GET /api/health` | publik | Pemeriksaan hidup. |

Data disimpan pada `data/store.json` (maks. 500 pesan terakhir). Cadangkan berkas ini secara berkala.

## Keamanan
- Wajib: ganti `SESSION_SECRET`, gunakan `ADMIN_PASSWORD_HASH`, dan pasang HTTPS (hosting modern menyediakannya).
- Semua masukan divalidasi di server; teks harga dibuat otomatis dari angka, dan estimasi dihitung ulang di server.
- Panel admin memakai Content-Security-Policy ketat dan tidak dapat dibuka dalam iframe.
- Jangan menaruh kunci rahasia di folder `frontend`, karena semua orang dapat membacanya.

## Pengujian
`npm test` menjalankan 7 uji otomatis: harga publik, login, validasi, perubahan harga, pesan masuk dengan email, dan penolakan data tidak valid.
