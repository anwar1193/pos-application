# POS Admin

Web admin untuk operasional toko: autentikasi, dashboard, dan manajemen pengguna.
Implementasi dari [issue #2](https://github.com/anwar1193/pos-application/issues/2).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Turso / libSQL + Drizzle ORM
- Argon2id (`@node-rs/argon2`)
- Zod + React Hook Form
- Vitest (unit & integration) + Playwright (E2E)

## Prasyarat

- Node.js 22+
- npm
- Database libSQL lokal (`file:./local.db`) atau database Turso

## Setup

```bash
npm install
cp .env.example .env.local
# isi kredensial database dan akun owner seed
npm run db:setup
npm run dev
```

Buka `http://localhost:3000`. Masuk memakai `SEED_OWNER_EMAIL` dan
`SEED_OWNER_PASSWORD` dari `.env.local`.

### Environment variables

| Variable | Wajib | Keterangan |
|---|---|---|
| `TURSO_DATABASE_URL` | ya | `file:./local.db` untuk lokal atau `libsql://...` untuk Turso |
| `TURSO_AUTH_TOKEN` | untuk Turso | Token akses database |
| `APP_URL` | ya | Basis URL untuk tautan undangan dan reset password |
| `SEED_OWNER_EMAIL` | saat seed | Email owner awal |
| `SEED_OWNER_PASSWORD` | saat seed | Password owner awal, minimal 12 karakter |
| `SEED_ORGANIZATION_NAME` | tidak | Nama organisasi seed |
| `SEED_BRANCH_NAME` | tidak | Nama cabang seed |

## Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server development |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run db:generate` | Generate migrasi Drizzle |
| `npm run db:migrate` | Terapkan migrasi |
| `npm run db:seed` | Seed data awal (idempoten) |
| `npm run db:setup` | Migrasi + seed |
| `npm test` | Unit & integration test (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | E2E test (Playwright) |

Playwright membutuhkan browser Chromium:

```bash
npx playwright install chromium
```

E2E memakai database terpisah `e2e.db` yang dibuat ulang setiap run dan
tidak menyentuh `local.db`.

## Struktur

```text
src/
  app/
    (dashboard)/        dashboard, users, account (dilindungi guard)
    api/                route handler auth, users, dashboard
    invite/[token]/     penerimaan undangan (publik)
    login/              halaman masuk
    reset-password/     reset password via token (publik)
  components/           shell admin dan komponen UI
  db/                   schema, migrasi, seed
  lib/
    auth/               session, login, RBAC, rate limit, token
    users/              service manajemen pengguna
    dashboard/          agregasi statistik dashboard
  middleware.ts         redirect awal berbasis cookie
```

## Model keamanan

- Session opaque; hanya hash SHA-256 token yang disimpan di database.
- Cookie `pos_session`: HttpOnly, SameSite=Lax, Secure di produksi.
- Idle timeout 7 hari, absolute timeout 30 hari.
- Semua query data pengguna difilter `organization_id` dari session.
- Permission diverifikasi di server pada setiap route dan service.
- Rate limit login dan lockout akun setelah percobaan berulang.
- Origin/Referer divalidasi untuk setiap mutasi.
- Password di-hash dengan Argon2id; minimal 12 karakter.
- Undangan dan token reset password berlaku sekali dan disimpan sebagai hash.
- Aksi sensitif dicatat di audit log tanpa password/token/cookie.

Aturan role:

- Hanya Owner, Admin, dan Manager yang dapat memakai Web Admin.
- Hanya Owner yang dapat memberikan role Owner/Admin.
- Admin tidak dapat mengubah atau menonaktifkan Owner.
- Pengguna tidak dapat menonaktifkan diri sendiri.
- Owner aktif terakhir dilindungi.

## Testing

- **Unit**: password policy, token, matriks permission, safe redirect.
- **Integration**: login/rate limit/lockout, session, undangan sekali pakai,
  reset password, isolasi organisasi, proteksi Owner, pencabutan session.
- **E2E**: owner login → dashboard → undang Admin → Admin aktif dan login →
  Admin undang Kasir → Kasir ditolak Web Admin → logout dan session tidak valid.

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

## Catatan operasional

- `npm run db:seed` aman dijalankan ulang.
- Migrasi dijalankan dari database kosong oleh `npm run db:migrate`.
- Jangan menaruh `.env.local`, database lokal, atau token di repository.
- Untuk Turso, isi `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`, lalu jalankan
  `npm run db:migrate`.
