# POS Admin

Web admin lengkap untuk operasional toko: autentikasi, dashboard, katalog,
inventaris, kasir (POS), shift, pembelian, pelanggan, supplier, laporan, audit
log, dan pengaturan organisasi. Implementasi web dari
[issue #1](https://github.com/anwar1193/pos-application/issues/1).

Workspace ini berada di dalam monorepo `pos-application`; aplikasi mobile ada
di `mobile-app/` (belum di-scaffold). Lihat [README root](../README.md) untuk
gambaran monorepo.

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

Dependency dipasang sekali dari root monorepo:

```bash
npm install
```

Lalu siapkan environment dan database web:

```bash
cp web-app/.env.example web-app/.env.local
# isi kredensial database dan akun owner seed

npm run db:setup
npm run dev
```

Script di atas dijalankan dari root dan otomatis didelegasikan ke workspace
`web-app`. Alternatifnya, jalankan dari dalam folder `web-app/` dengan
`npm run db:setup` dan `npm run dev` seperti biasa.

Buka `http://localhost:3000`. Masuk memakai `SEED_OWNER_EMAIL` dan
`SEED_OWNER_PASSWORD` dari `web-app/.env.local`.

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
| `RESEND_API_KEY` | tidak | API key Resend untuk pengiriman email undangan/reset |
| `EMAIL_FROM` | tidak | Alamat pengirim email, mis. `POS Admin <no-reply@toko.id>` |
| `EMAIL_DEV_MODE` | tidak | `true` untuk menampilkan tautan undangan/reset di response saat email tidak terkirim |

Tanpa `RESEND_API_KEY` dan `EMAIL_FROM`, email tidak dikirim. Tautan undangan
tetap ditampilkan sekali di UI, dan tautan reset password dikembalikan pada
response development agar alur dapat diuji lokal.

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

## Cakupan

Yang termasuk: seluruh alur back-office web dari issue, termasuk POS, katalog,
inventaris, pembelian, shift, laporan, audit, pengaturan, dan pemilihan
organisasi/cabang untuk pengguna dengan lebih dari satu keanggotaan. Gambar
produk memakai URL (belum ada unggah berkas ke object storage).

Ekstensi opsional yang belum dikerjakan: varian produk, price list bertingkat,
pusat notifikasi, dan aplikasi mobile. Varian produk ditandai opsional pada
issue dan tidak menghalangi alur inti.

## Halaman web
| Route | Akses | Fungsi |
|---|---|---|
| `/login` | publik | Masuk dengan email dan password |
| `/register` | publik | Daftar bisnis baru + cabang pertama + akun owner |
| `/forgot-password` | publik | Minta tautan reset password |
| `/reset-password/[token]` | publik | Atur password baru dari tautan |
| `/invite/[token]` | publik | Aktifkan akun dari undangan |
| `/dashboard` | `dashboard.view` | Ringkasan penjualan, stok rendah, aktivitas |
| `/pos` | `sale.create` | Kasir: cari produk, keranjang, diskon, pajak, multi-pembayaran, parkir, struk |
| `/sales` | `sale.view` | Daftar transaksi + filter |
| `/sales/[id]` | `sale.view` | Detail transaksi, cetak/unduh struk, void, refund |
| `/shifts` | `shift.view` | Buka/tutup shift, kas masuk/keluar, selisih kas, persetujuan |
| `/catalog` | `catalog.view` | Produk, kategori, satuan, barcode, impor/ekspor CSV, bulk update |
| `/inventory` | `inventory.view` | Stok per cabang, penyesuaian, transfer, opname, riwayat pergerakan |
| `/inventory/opname/[id]` | `inventory.opname` | Hitung fisik dan selesaikan opname |
| `/customers` | `customer.view` | Daftar pelanggan dan riwayat belanja |
| `/customers/[id]` | `customer.view` | Detail pelanggan |
| `/suppliers` | `supplier.view` | Daftar supplier |
| `/purchases` | `purchase.view` | Daftar purchase order dan statusnya |
| `/purchases/new` | `purchase.manage` | Buat purchase order |
| `/purchases/[id]` | `purchase.view` | Detail PO, kirim, terima barang, batalkan |
| `/reports` | `report.view` | Laporan penjualan, pembayaran, produk, margin, stok, mutasi, pembelian, refund, void, rekonsiliasi shift + CSV/cetak |
| `/users` | `user.view` | Daftar pengguna dan status |
| `/users/invite` | `user.invite` | Undang pengguna baru |
| `/users/[id]` | `user.view` | Detail pengguna, role, cabang, sesi, reset password |
| `/settings` | `settings.manage` | Profil bisnis, pajak, cabang, metode pembayaran |
| `/audit` | `audit.view` | Audit log dengan filter |
| `/account` | login | Profil sendiri |
| `/account/password` | login | Ganti password sendiri |

## Struktur

```text
src/
  app/
    (dashboard)/        dashboard, POS, katalog, inventaris, penjualan,
                        shift, pembelian, pelanggan, supplier, laporan,
                        pengguna, pengaturan, audit, akun
    api/                route handler auth, katalog, inventaris, POS,
                        pembelian, laporan, pengaturan, audit
    invite/[token]/     penerimaan undangan (publik)
    login/              halaman masuk
    register/           pendaftaran bisnis baru
    forgot-password/    permintaan reset password
    reset-password/     reset password via token (publik)
  components/           shell admin dan komponen UI
  db/                   schema, migrasi, seed
  lib/
    auth/               session, login, register, RBAC, rate limit, token
    branches/           scope dan resolusi cabang
    catalog/            produk, kategori, satuan, CSV
    inventory/          ledger stok, penyesuaian, transfer, opname
    sales/              transaksi, pembayaran, refund, void, parkir
    shifts/             buka/tutup shift dan rekonsiliasi kas
    purchasing/         supplier dan purchase order
    reports/            agregasi seluruh laporan
    settings/           organisasi, cabang, metode pembayaran
    users/              manajemen pengguna dan undangan
    dashboard/          agregasi statistik dashboard
  middleware.ts         redirect awal berbasis cookie
```

## Model keamanan

- Session opaque; hanya hash SHA-256 token yang disimpan di database.
- Cookie `pos_session`: HttpOnly, SameSite=Lax, Secure di produksi.
- Idle timeout 7 hari, absolute timeout 30 hari.
- Semua query data difilter `organization_id` dari session; data cabang
  dibatasi sesuai scope peran.
- Permission diverifikasi di server pada setiap route dan service.
- Rate limit login dan lockout akun setelah percobaan berulang.
- Origin/Referer divalidasi untuk setiap mutasi.
- Password di-hash dengan Argon2id; minimal 12 karakter.
- Undangan dan token reset password berlaku sekali dan disimpan sebagai hash.
- Aksi sensitif dicatat di audit log tanpa password/token/cookie.
- Transaksi penjualan, stok, refund, void, dan shift berjalan dalam transaksi
  database; pergerakan stok bersifat immutable.

Aturan role:

- Semua peran operasional (Owner, Admin, Manajer, Kasir, Staf Gudang) dapat
  masuk Web Admin sesuai permission masing-masing.
- Kasir mendapat workspace POS, transaksi, shift, dan pelanggan.
- Staf Gudang mendapat katalog, inventaris, pembelian, dan laporan.
- Manajer mendapat akses operasional dan laporan tanpa pengaturan organisasi.
- Hanya Owner yang dapat memberikan role Owner/Admin.
- Admin tidak dapat mengubah atau menonaktifkan Owner.
- Pengguna tidak dapat menonaktifkan diri sendiri.
- Owner aktif terakhir dilindungi.
- Undangan staf tanpa cabang otomatis diarahkan ke cabang aktif pertama agar
  akun langsung dapat beroperasi; cabang dapat diubah kemudian.

## Testing

- **Unit**: password policy, token, matriks permission, safe redirect.
- **Integration**: register, login/rate limit/lockout, session, undangan sekali
  pakai + scope cabang, reset password, isolasi organisasi, proteksi Owner,
  pencabutan session, pemilihan organisasi, transaksi POS (stok, pembayaran,
  idempotensi, void, refund), ledger inventaris (penyesuaian, transfer, opname),
  shift (satu shift terbuka, rekonsiliasi kas, ambang persetujuan), dan katalog
  (SKU/barcode unik, arsip, impor CSV).
- **E2E**: owner login → dashboard → undang Admin → Admin aktif dan login →
  Admin undang Kasir → Kasir membuka POS tanpa menu pengaturan → logout dan
  session tidak valid; cookie session basi tidak membuat redirect loop.

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
- Untuk email undangan/reset di produksi, isi `RESEND_API_KEY`, `EMAIL_FROM`,
  dan pastikan `APP_URL` memakai URL publik.
