import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Link className="mb-8 inline-flex items-center gap-2 focus-ring" href="/dashboard">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-forest text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
        </Link>
        <p className="text-[64px] font-bold leading-none tracking-tight text-line">404</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-secondary">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
          href="/dashboard"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
