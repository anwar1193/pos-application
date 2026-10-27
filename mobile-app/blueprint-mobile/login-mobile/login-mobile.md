---
name: Tactile Ledger POS
colors:
  surface: '#eefdf3'
  surface-dim: '#ceded4'
  surface-bright: '#eefdf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e8f7ed'
  surface-container: '#e2f2e8'
  surface-container-high: '#dcece2'
  surface-container-highest: '#d7e6dc'
  on-surface: '#111e18'
  on-surface-variant: '#404943'
  inverse-surface: '#26332d'
  inverse-on-surface: '#e5f4ea'
  outline: '#707973'
  outline-variant: '#c0c9c2'
  surface-tint: '#2f6950'
  primary: '#003a27'
  on-primary: '#ffffff'
  primary-container: '#14523b'
  on-primary-container: '#88c4a6'
  inverse-primary: '#97d3b5'
  secondary: '#536259'
  on-secondary: '#ffffff'
  secondary-container: '#d4e3d9'
  on-secondary-container: '#58665e'
  tertiary: '#2b342f'
  on-tertiary: '#ffffff'
  tertiary-container: '#414a45'
  on-tertiary-container: '#b0b9b3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b2f0d0'
  primary-fixed-dim: '#97d3b5'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#12503a'
  secondary-fixed: '#d7e6dc'
  secondary-fixed-dim: '#bbcac0'
  on-secondary-fixed: '#111e18'
  on-secondary-fixed-variant: '#3c4a42'
  tertiary-fixed: '#dce5de'
  tertiary-fixed-dim: '#c0c9c2'
  on-tertiary-fixed: '#151d19'
  on-tertiary-fixed-variant: '#404944'
  background: '#eefdf3'
  on-background: '#111e18'
  surface-variant: '#d7e6dc'
typography:
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Archivo Narrow
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Archivo Narrow
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Archivo Narrow
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Archivo Narrow
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Archivo Narrow
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Archivo Narrow
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  num-display:
    fontFamily: Archivo Narrow
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
  num-cell:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

Desain ini menggabungkan ketertiban pencatatan pembukuan fisik (*ledger*) dengan efisiensi alur kerja kasir modern melalui pendekatan **Tactile Minimalism**. Pengalaman visual dibangun menyerupai kertas cetak berkualitas tinggi, presisi garis cetak monokromatik, dan kejelasan tipografis ala instrumen inventaris industrial. 

Target pengguna adalah kasir, barista, dan staf ritel dengan tempo kerja tinggi yang menuntut kejelasan visual mutlak di bawah berbagai kondisi pencahayaan toko. Antarmuka ini menolak kedalaman artifisial, gradien dekoratif, maupun ornamen neon; fokus diarahkan seutuhnya pada keterbacaan data numerik, konfirmasi status transaksi yang tegas, serta umpan balik haptik/visual yang mantap. Kesan emosional yang dibangun adalah rasa kendali, keteraturan akuntansi klasik, kecepatan eksekusi, dan keandalan operasional tanpa distraksi.

## Colors

Palet warna dirancang dengan kontras fungsional tinggi yang meniru tinta stempel dan kertas pembukuan fisik:

- **Kanvas Utama (Paper Base):** `#F6F7F2` memberikan latar hangat menyerupai kertas bond tanpa menyilaukan mata saat giliran kerja panjang.
- **Panel & Permukaan Kartu:** `#FFFFFF` murni yang dibatasi garis tegas untuk menciptakan kontras pemisahan data.
- **Hairline Border:** `#DCE4DD` sebagai garis batas struktural konsisten 1px.
- **Aksen Hijau Hutan (Primary System):**
  - Default: `#14523B` (warna utama aksi, badge total bayar, status aktif).
  - Hover / Pressed State: `#0E3F2D`.
  - Deep / Container Header: `#003A27`.
  - Moss Tint (Soft Background / Chip Tag): `#E4EDE6`.
- **Hirarki Tipografi Tinta (Ink System):**
  - Ink Primary (Teks Utama & Nilai Moneter): `#13201A`.
  - Ink Secondary (Label Kolom & Metadata): `#4C5A52`.
  - Ink Muted (Placeholder, Garis Panduan, Hint): `#6E7B73`.
- **Status Operasional:**
  - Sukses: `#067647` teks/ikon dengan latar `#DCFAE6`.
  - Peringatan (Warning): `#B45309` teks/ikon dengan latar `#FEF3C7`.
  - Kesalahan / Batal (Error/Brick): `#B42318` teks/ikon dengan latar `#FEE4E2`.

## Typography

Tipografi didasarkan sepenuhnya pada **Archivo Narrow** untuk memaksimalkan densitas informasi tanpa mengorbankan keterbacaan pada layar genggam. Proporsinya yang ringkas memungkinkan nama produk panjang dan kalkulasi multi-digit tampil utuh dalam satu baris.

**Ketentuan Tabular Numerals:**
Semua angka yang merepresentasikan nominal mata uang (IDR), kuantitas stok, diskon, nomor struk, dan jam transaksi wajib mengaktifkan fitur OpenType `font-feature-settings: "tnum" 1` (tabular figures). Hal ini menjamin bahwa seluruh deret angka pada tabel kalkulasi struk dan kasir sejajar vertikal secara sempurna. Huruf kapital digunakan pada label meta pendek (contoh: `SUBTOTAL`, `PPN 11%`, `KEMBALIAN`) dengan letter-spacing `0.05em`.

## Layout & Spacing

Sistem tata letak dioptimalkan untuk perangkat mobile potret (lebar viewport 360px - 428px) serta tablet kasir (posisi landscape mini):

- **Grid & Safe Area:** Menggunakan sistem kolom dinamis dengan margin luar kanvas tetap `16px` (`margin: 1rem`), dan jarak pemisah kolom komponen katalog produk `12px` (`gutter: 0.75rem`).
- **Skala Spacing Internal:**
  - `space-xs` (4px): Pemisah antara teks label dan nilainya pada baris ringkas.
  - `space-sm` (8px): Ruang dalam sel, jarak antar item keranjang, dan padding vertikal chip.
  - `space-md` (12px): Padding internal kartu pesanan dan form input.
  - `space-lg` (16px): Padding modul panel kontainer, tombol utama, dan gap antar kartu pesanan.
  - `space-xl` (24px): Pemisah antar seksi fungsional (misal: antara keranjang dan rincian pajak).
- **Target Sentuh Operasional:** Semua area interaktif (tombol penambahan quantity `+`/`-`, opsi pembayaran, tombol aksi, item baris) wajib memiliki tinggi dan lebar area aktif minimum **48dp** (48px) guna mencegah kesalahan ketuk kasir pada jam sibuk.

## Elevation & Depth

Desain ini menganut prinsip **Flat & Pure Hairline Boundaries** tanpa menggunakan drop-shadow pada level permukaan biasa:

- **Hirarki Bidang Datar:** Kedalaman visual tidak dibentuk oleh bayangan, melainkan oleh pelapisan warna kanvas: Kanvas Kertas (`#F6F7F2`) sebagai dasar paling bawah, Panel Putih (`#FFFFFF`) berbatas garis hairline `1px solid #DCE4DD` sebagai modul operasional di atasnya.
- **Pengecualian Bayangan (Hanya Modal & Bottom Sheet Kasir):**
  - Lapisan overlay penutup keranjang belanja atau dialog bayar menggunakan backdrop scrim berwarna `#13201A` dengan opasitas 40%.
  - Lembar modal lembar bawah (bottom sheet) menggunakan bayangan difus netral: `0px -4px 20px rgba(19, 32, 26, 0.08)` dipadukan dengan border batas atas `1px solid #DCE4DD`.
- **Motif Struktural Khas:**
  - **Ledger Grid 28px:** Pola kotak panduan grid garis putih opasitas 6% (`rgba(255, 255, 255, 0.06)`) diterapkan khusus pada area hero hijau tua (`#003A27` / `#14523B`) menyerupai kertas buku kas.
  - **Perforasi Struk Kasir:** Pemisah dekoratif fungsional antara modul hero ringkasan kasir dan panel rincian di bawahnya menggunakan lekukan setengah lingkaran (*half-circle notches*) berdiameter 12px dengan jarak pitch antar pusat lingkaran 24px, memotong batas kertas secara visual.

## Shapes

Bahasa bentuk distandarisasi untuk mencerminkan ketegasan perangkat kerja industri kasir:

- **Radius 8px (`rounded-sm` / Kontrol):** Diterapkan pada tombol aksi (`Primary/Secondary Button`), field masukan teks/numpad, dan kontrol stepper penambahan kuantitas (`-` / `+`).
- **Radius 12px (`rounded-md` / Panel & Kartu):** Diterapkan pada kartu produk katalog, sel daftar transaksi dalam keranjang belanja, panel kalkulasi diskon, dan kartu kasir.
- **Radius 16px (`rounded-lg` / Sheet & Hero Overlap):** Diterapkan pada sudut atas Bottom Sheet kasir, modul geser ringkasan transaksi, dan kontainer hero kalkulasi.
- **Full Pill (`rounded-full`):** Khusus diperuntukkan bagi status badge (contoh: status order `DRAFT`, `LUNAS`, `DIBATALKAN`) dan chip kategori menu cepat.
- **Indikator Aktif Navigasi:** Menggunakan batang persegi panjang vertikal berukuran tepat `3px x 24px` berwarna `#14523B` yang terpasang di samping atau atas ikon aktif bilah navigasi bawah (*Bottom Navigation Bar*).

## Components

### Tombol (Buttons)
- **Tombol Utama (Bayar / Konfirmasi):** Tinggi minimum 48px, latar belakang `#14523B`, teks putih `#FFFFFF` (Archivo Narrow 16px SemiBold), radius 8px, tanpa bayangan. Saat ditekan (*pressed state*), warna berganti menjadi `#0E3F2D`.
- **Tombol Sekunder (Batal / Tahan Pesanan):** Tinggi minimum 48px, latar belakang `#FFFFFF`, garis batas 1px `#DCE4DD`, teks tinta `#13201A`, radius 8px.
- **Tombol Quantity Stepper:** Blok kembar 48x48px (atau minimum 40x40px dalam sel padat) berlatar `#E4EDE6` dengan simbol minus/plus berwarna `#14523B`.

### Chips & Kategori Cepat
- Tinggi 36px (dengan area tap 48px via invisible padding), bentuk pil (`rounded-full`).
- Keadaan tidak aktif: latar belakang `#FFFFFF`, border 1px `#DCE4DD`, teks `#4C5A52`.
- Keadaan aktif: latar belakang `#E4EDE6`, border 1px `#14523B`, teks `#14523B` bobot 600.

### Input & Kolom Angka (Numpad POS)
- Tinggi field 48px, latar `#FFFFFF`, border 1px `#DCE4DD`, teks `#13201A` ukuran 16px dengan tabular numerals.
- Kondisi fokus: border 1.5px `#14523B` tanpa outer-glow kabur.
- Tuts Numpad Tunai Kasir: Sel kartu berbentuk grid 3x4 dengan border internal 1px `#DCE4DD`, latar `#FFFFFF`, angka tengah 22px tabular, feedback aktif latar `#F6F7F2`.

### Kartu Produk & Item Keranjang (List Items)
- **Item Keranjang:** Rata kiri nama item dan rincian harga satuan, rata kanan total harga item (tabular figures), dipisahkan garis pemisah 1px `#DCE4DD`. Tinggi baris minimum 52px.
- **Kartu Produk Katalog:** Permukaan putih `#FFFFFF`, border 1px `#DCE4DD`, radius 12px, menampilkan foto/ikon produk, nama ringkas 2 baris (14px), dan harga jelas berwarna `#14523B` (15px SemiBold Tabular).

### Kotak Centang & Opsi Radio
- Kotak centang berukuran 20x20px dalam target sentuh 48x48px, radius 4px, border 1.5px `#4C5A52`. Saat tercentang: latar `#14523B` dengan centang putih tebal.

### Hero Ringkasan Kasir & Struk (Receipt Module)
- Latar atas menggunakan `#003A27` dengan Ledger Grid 28px (`rgba(255,255,255,0.06)`). Teks total tagihan menggunakan `num-display` berwarna putih kontras.
- Di bagian bawah hero, terdapat pola perforasi struk (gerigi/notches 12px lingkaran pitch 24px) yang bersambung dengan panel konten putih di bawahnya.