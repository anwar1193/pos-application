import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-surface border border-line rounded-panel p-8">
        <span className="material-symbols-outlined text-amber text-[32px]">lock</span>
        <h1 className="mt-4 text-2xl font-semibold text-ink">Akses tidak tersedia</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Role Anda tidak memiliki izin untuk membuka halaman ini. Hubungi Owner atau Admin
          organisasi jika akses dibutuhkan.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
