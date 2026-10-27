# Mobile App

Aplikasi mobile POS (rencana: React Native). Folder ini masih berupa
placeholder di dalam monorepo dan belum berisi scaffold aplikasi.

## Status

- [ ] Pilih dan scaffold framework (Expo / React Native CLI)
- [ ] Tentukan kontrak API dengan `web-app`
- [ ] Implementasi autentikasi, katalog, kasir, shift, dan laporan

## Catatan monorepo

- Dependency dipasang dari root repo: `npm install`
- Ketika nanti ada script, jalankan dengan `npm run <script> -w mobile-app`
- Kode yang dipakai bersama web dan mobile diekstrak ke `packages/shared`
  saat benar-benar dibutuhkan, bukan sejak awal.

Tech stack acuan ada di dokumen perencanaan project (Next.js untuk web,
React Native untuk mobile, Turso untuk database).
