"use client";

export function PrintButton() {
  return (
    <button
      className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
      onClick={() => window.print()}
      type="button"
    >
      <span className="material-symbols-outlined text-[18px]">print</span>
      Cetak
    </button>
  );
}
