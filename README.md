# POS Application

Monorepo untuk aplikasi Point of Sales, terdiri dari web admin dan aplikasi
mobile.

## Struktur

```text
pos-application/
  web-app/     Web admin — Next.js 15 + React 19 + Tailwind + Turso/Drizzle
  mobile-app/  Aplikasi mobile — React Native (belum di-scaffold)
```

- `web-app/` berisi seluruh kode web yang sudah ada (lihat
  [web-app/README.md](web-app/README.md) untuk dokumentasi lengkap).
- `mobile-app/` masih placeholder; scaffold menyusul.

## Prasyarat

- Node.js 22+
- npm (npm workspaces, tanpa tooling monorepo tambahan)

## Setup

```bash
npm install
```

Dependency untuk semua workspace dipasang dari root dan di-hoist ke
`node_modules/` di root.

## Scripts

Script yang umum dijalankan lewat root (mendelegasikan ke `web-app`):

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan web admin di development |
| `npm run build` | Build produksi web admin |
| `npm run start` | Menjalankan hasil build web admin |
| `npm run lint` | ESLint web admin |
| `npm run typecheck` | Pemeriksaan TypeScript web admin |
| `npm test` | Unit & integration test web admin |
| `npm run test:e2e` | E2E test web admin (Playwright) |
| `npm run db:setup` | Migrasi + seed database web admin |

Untuk menjalankan script milik workspace tertentu secara langsung:

```bash
npm run <script> --workspace web-app
npm run <script> --workspace mobile-app
```

## Database dan environment

Konfigurasi web ada di `web-app/.env.local` (lihat
`web-app/.env.example`). Database lokal (`local.db`, `e2e.db`) juga berada di
`web-app/`. Detail variabel environment dan setup database ada di
[web-app/README.md](web-app/README.md).

## Catatan

- Kode bersama (tipe, schema validasi) belum diekstrak ke paket sendiri. Jika
  mobile app mulai membutuhkan kontrak yang sama, tambahkan `packages/shared`
  sebagai workspace baru.
- Jangan commit `.env.local`, database lokal, atau token.
