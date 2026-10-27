"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brick-bg text-brick">
        <span className="material-symbols-outlined text-[24px]">error</span>
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Halaman gagal dimuat
      </h1>
      <p className="mt-2 text-sm leading-6 text-secondary">
        Terjadi kesalahan saat mengambil data. Coba muat ulang halaman ini.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted">Kode: {error.digest}</p>
      ) : null}
      <button
        className="mt-6 flex h-10 items-center justify-center rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
        onClick={reset}
        type="button"
      >
        Coba lagi
      </button>
    </div>
  );
}
