"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OpnameComplete({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/opname/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string; fields?: Record<string, string> } }
        | null;
      if (!response.ok) {
        const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
        throw new Error(field ?? payload?.error?.message ?? "Gagal menyelesaikan opname.");
      }
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyelesaikan opname.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="material-symbols-outlined text-[18px]">check_circle</span>
        Selesaikan opname
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative w-full max-w-md rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={submit}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Selesaikan stock opname?</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Selisih antara stok sistem dan hitungan fisik akan diterapkan sebagai pergerakan stok
              penyesuaian. Tindakan ini tidak dapat dibatalkan.
            </p>
            <label className="mt-3 flex flex-col gap-1 text-[12px] font-semibold text-ink">
              Catatan (opsional)
              <textarea
                className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                value={reason}
              />
            </label>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? "Memproses..." : "Ya, selesaikan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
