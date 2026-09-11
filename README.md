# Daftar Hadir Panitia (Clock In / Clock Out)

Aplikasi absensi clock in / clock out untuk panitia acara, berbasis **izin token dari PIC**.

## Fitur

- **Clock In / Clock Out tanpa login** — panitia cukup memasukkan **token 6 digit** yang diberikan PIC
- **Token 6 digit unik per event** — digenerate otomatis oleh PIC, validasi di server (tidak bisa dipalsukan)
- **Role Admin & PIC**:
  - **Admin** — melihat semua event, token, dan seluruh record
  - **PIC** — membuat event, generate token, HANYA melihat record dari event yang dia buat
- **Registrasi event** — PIC mendaftarkan acara, generate token, dan pantau kehadiran
- **Rekap & statistik** — filter per event, durasi kerja otomatis, status selesai/bekerja

## Tech Stack

- **Next.js 16** (App Router) + Tailwind CSS
- **PostgreSQL via Neon.tech** (`pg` / node-postgres)
- **JWT session** (`jose`) + password bcrypt
- **Vercel** — serverless deployment

## Cara Kerja

```
1. User pertama register -> otomatis menjadi ADMIN
2. User berikutnya register -> menjadi PIC
3. PIC membuat event (nama, tanggal, lokasi)
4. PIC generate token 6 digit untuk event (misal: 741023)
5. PIC bagikan token ke panitia (WhatsApp/verbal)
6. Panitia buka app, masukkan token, lalu clock in/out
7. PIC/Admin lihat rekap melalui dashboard
```

## Jalankan Lokal

```bash
npm install
sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://localhost/kehadiran|" .env.local
sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=ganti-dengan-secret-random-32-char-min|" .env.local
npm run dev
```

Tabel (`users`, `events`, `tokens`, `attendance`) otomatis dibuat saat request pertama.

## Deploy ke Vercel

### 1. Buat database Neon

1. Daftar di [neon.tech](https://neon.tech) (gratis)
2. Buat database
3. Copy **Connection string** — untuk serverless gunakan koneksi **pooled** (host berakhiran `-pooler`) jika tersedia, atau string standar + `?sslmode=require`

### 2. Set environment variables di Vercel

**Vercel Dashboard → Project → Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx-xx.aws.neon.tech/kehadiran?sslmode=require` |
| `JWT_SECRET` | secret acak (contoh: `openssl rand -base64 32`) |

### 3. Deploy

```bash
vercel --prod
```

Atau via **Vercel Dashboard**: import repo GitHub → otomatis terdeteksi Next.js → Deploy.

## Struktur Proyek

```
src/
├── app/
│   ├── page.tsx                    # Clock in/out (publik, butuh token)
│   ├── login/page.tsx              # Login / register PIC & Admin
│   ├── dashboard/page.tsx          # Panel PIC/Admin
│   ├── api/
│   │   ├── auth/register/route.ts  # Register (user pertama = admin)
│   │   ├── auth/login/route.ts     # Login
│   │   ├── auth/me/route.ts        # Cek sesi
│   │   ├── auth/logout/route.ts    # Logout
│   │   ├── events/route.ts         # CRUD event (auth)
│   │   ├── tokens/route.ts         # Generate token (auth)
│   │   ├── tokens/validate/route.ts# Validasi token (publik)
│   │   ├── clock-in/route.ts       # Absen masuk (butuh token)
│   │   ├── clock-out/route.ts      # Absen pulang (butuh token)
│   │   └── records/route.ts        # Rekap (admin/pic)
│   └── layout.tsx
└── lib/
    ├── db.ts                       # Koneksi PostgreSQL + schema
    └── auth.ts                     # JWT session + password
```

## API

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| POST | `/api/auth/register` | - | Username, password, name |
| POST | `/api/auth/login` | - | Username, password |
| POST | `/api/auth/logout` | ✓ | Hapus sesi |
| GET | `/api/auth/me` | ✓ | Info user |
| POST | `/api/events` | ✓ | Buat event |
| GET | `/api/events` | ✓ | Admin: semua; PIC: event sendiri |
| POST | `/api/tokens` | ✓ | Generate token 6 digit untuk event |
| POST | `/api/tokens/validate` | - | Validasi token (tanpa login) |
| POST | `/api/clock-in` | token | Clock in (butuh token + event_id) |
| POST | `/api/clock-out` | token | Clock out (butuh token + event_id) |
| GET | `/api/records` | ✓ | Admin: semua; PIC: hanya event sendiri |

### Aturan bisnis

- **Role**: user pertama register = `admin`, selanjutnya = `pic`
- **PIC tidak bisa melihat/ubah record event milik PIC lain** (isolasi via `user_id` di event)
- Satu karyawan hanya bisa **clock in 1× per hari per event** (409 jika ganda)
- **Token unik per event** — regenerate token lama otomatis invalid
- Clock out tanpa clock in aktif ditolak (404)