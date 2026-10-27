# Mobile App — POS Kasir

Aplikasi mobile untuk kasir (Expo SDK 58 / React Native). Scope saat ini:
**Login & Dashboard** (GitHub issue #5).

## Menjalankan aplikasi

### 1. Siapkan backend

Mobile app memanggil endpoint bearer `/api/mobile/*` di `web-app`. Jalankan
backend lebih dulu dari root repo:

```bash
npm install          # dari root repo
cp web-app/.env.example web-app/.env.local   # jika .env.local belum ada
npm run db:setup     # migrasi + seed data demo
npm run dev          # web-app di http://localhost:3000
```

Untuk pengembangan lokal, isi `TURSO_DATABASE_URL=file:./local.db` di
`web-app/.env.local`. Akun yang dibuat seed diambil dari `SEED_OWNER_EMAIL`
dan `SEED_OWNER_PASSWORD` di file tersebut.

### 2. Arahkan mobile app ke backend

Salin `mobile-app/.env.example` menjadi `mobile-app/.env` lalu sesuaikan
`EXPO_PUBLIC_API_URL` dengan tempat backend berjalan:

| Target | Nilai `EXPO_PUBLIC_API_URL` |
| --- | --- |
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Perangkat fisik (Expo Go) | `http://<IP-LAN-komputer>:3000` (mis. `http://192.168.1.10:3000`) |

Restart `expo start` setelah mengubah `.env` — nilai ini dibaca saat bundling.

### 3. Jalankan Expo

```bash
npm run start --workspace mobile-app
```

Lalu tekan `i` (iOS Simulator), `a` (Android Emulator), atau pindai QR dengan
Expo Go. Pastikan `EXPO_PUBLIC_API_URL` sesuai target di atas.

### 4. Masuk

Seed hanya membuat satu akun, yaitu owner organisasi
(`SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` di `web-app/.env.local`). Dengan
nilai bawaan repo ini akun tersebut adalah:

- Email: `rani@demostore.id`
- Password: `demoKasir2026!`

Role owner memiliki `shift.view` + `sale.view`, sehingga dashboard mobile
dapat dimuat. Kredensial yang sama dipakai sebagai fixture pada integration
test mobile di `web-app`; mengubahnya di `.env.local` membuat akun demo
tersebut berbeda tanpa memengaruhi test.

Perilaku yang diharapkan:

1. Splash → redirect ke `/login` bila belum ada sesi.
2. Login sukses → dashboard menampilkan sapaan, kartu shift, ringkasan
   operasional hari ini, aksi cepat, dan transaksi terakhir.
3. "Ingat terminal ini" aktif secara default: token disimpan di SecureStore.
   Bila dimatikan, token hanya bertahan sampai aplikasi ditutup.
4. Tarik ke bawah di dashboard untuk memuat ulang, atau tekan "Coba Lagi"
   saat gagal memuat.
5. Ketuk avatar di kanan atas lalu konfirmasi "Keluar" untuk mengakhiri sesi.

## Struktur

```
app/                     # rute expo-router
  _layout.tsx            # provider: SafeArea, React Query, Auth, font Archivo Narrow
  index.tsx              # redirect sesuai status sesi
  login.tsx              # layar login
  (app)/_layout.tsx      # guard: hanya untuk sesi aktif
  (app)/dashboard.tsx    # layar dashboard
src/
  api/                   # klien HTTP + endpoint mobile
  auth/                  # AuthProvider dan penyimpanan token
  components/            # komponen UI sesuai blueprint Tactile Ledger
  hooks/                 # useDashboard (React Query)
  lib/                   # format angka/tanggal, label status
  theme/                 # token warna, spacing, tipografi
__tests__/               # Jest + React Native Testing Library
blueprint-mobile/        # referensi desain (sumber token & layout)
```

## Perintah

```bash
npm test --workspace mobile-app        # Jest + RNTL
npm run typecheck --workspace mobile-app
npm run start --workspace mobile-app   # expo start
```

## Catatan pengembangan

- Transport: `app.json` hanya mengizinkan HTTP ke jaringan lokal
  (`NSAllowsLocalNetworking` di iOS, `usesCleartextTraffic` di Android) agar
  backend `http://localhost:3000` bisa diakses saat pengembangan. Untuk build
  produksi, layani API lewat HTTPS dan hapus `usesCleartextTraffic`.
- Semua warna, spacing, radius, dan tipografi berasal dari
  `src/theme/tokens.ts` (turunan blueprint `blueprint-mobile/`), bukan nilai
  literal di komponen.
- Endpoint yang dipakai: `POST /api/mobile/auth/login`,
  `GET /api/mobile/auth/session`, `POST /api/mobile/auth/logout`,
  `GET /api/mobile/dashboard`. Format respons `{ data, meta }` dan error
  `{ error: { code, message, fields, requestId } }`.
- Uji hook React Query memakai `notifyOnChangeProps: "all"` + fake timers:
  `renderHook` tidak membaca properti hasil query saat render, sehingga
  notifikasi perubahan tidak akan dikirim tanpa opsi tersebut.