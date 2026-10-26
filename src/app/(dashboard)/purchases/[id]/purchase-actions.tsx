"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatNumber } from "@/lib/format/money";

type Item = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
};

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok) {
    const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
    throw new Error(field ?? payload?.error?.message ?? "Permintaan gagal.");
  }
}

export function PurchaseActions({
  id,
  status,
  canManage,
  canReceive,
  items,
  currency,
}: {
  id: string;
  status: string;
  canManage: boolean;
  canReceive: boolean;
  items: Item[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.productId, "0"])),
  );

  async function act(action: "order" | "cancel") {
    if (action === "cancel" && !window.confirm("Batalkan purchase order ini?")) return;
    setBusy(action);
    setError(null);
    try {
      await post(`/api/purchases/${id}/action`, { action });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi gagal.");
    } finally {
      setBusy(null);
    }
  }

  async function submitReceive(event: React.FormEvent) {
    event.preventDefault();
    setBusy("receive");
    setError(null);
    try {
      const selected = items
        .map((item) => ({
          productId: item.productId,
          receivedQuantity: Number(quantities[item.productId] ?? 0),
        }))
        .filter((item) => item.receivedQuantity > 0);
      if (selected.length === 0) {
        throw new Error("Isi jumlah yang diterima minimal untuk satu produk.");
      }
      await post(`/api/purchases/${id}/receive`, {
        items: selected,
        notes: notes.trim() || null,
      });
      setReceiveOpen(false);
      setNotes("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menerima barang.");
    } finally {
      setBusy(null);
    }
  }

  function fillAll() {
    setQuantities(
      Object.fromEntries(
        items.map((item) => [item.productId, String(item.quantity - item.receivedQuantity)]),
      ),
    );
  }

  const canOrder = canManage && status === "draft";
  const canCancel = canManage && ["draft", "ordered"].includes(status);
  const showReceive = canReceive && ["ordered", "partially_received"].includes(status);

  if (!canOrder && !canCancel && !showReceive) return null;

  return (
    <>
      {canOrder ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("order")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          {busy === "order" ? "Memproses..." : "Pesan ke supplier"}
        </button>
      ) : null}
      {showReceive ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
          onClick={() => setReceiveOpen(true)}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">inventory</span>
          Terima barang
        </button>
      ) : null}
      {canCancel ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-brick/30 bg-white px-3 text-sm font-semibold text-brick hover:bg-brick-bg disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("cancel")}
          type="button"
        >
          {busy === "cancel" ? "Memproses..." : "Batalkan"}
        </button>
      ) : null}
      {error && !receiveOpen ? <span className="text-[12px] text-brick">{error}</span> : null}

      {receiveOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setReceiveOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-5 text-left shadow-overlay"
            onSubmit={submitReceive}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Terima barang</h2>
                <p className="mt-1 text-[12px] text-muted">
                  Masukkan jumlah yang benar-benar diterima. Stok bertambah saat disimpan.
                </p>
              </div>
              <button
                className="text-[11px] font-semibold text-forest underline"
                onClick={fillAll}
                type="button"
              >
                Isi semua sisa
              </button>
            </div>
            <ul className="mt-3 divide-y divide-line rounded border border-line">
              {items.map((item) => {
                const remaining = item.quantity - item.receivedQuantity;
                return (
                  <li className="flex items-center gap-2 px-3 py-2" key={item.productId}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-ink">
                        {item.productName}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {item.sku} · dipesan {formatNumber(item.quantity)} · sisa{" "}
                        {formatNumber(remaining)}
                      </span>
                    </span>
                    <input
                      aria-label={`Diterima ${item.productName}`}
                      className="h-8 w-24 rounded border border-line px-2 text-right text-[12px] text-ink"
                      max={remaining}
                      min="0"
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.productId]: event.target.value,
                        }))
                      }
                      step="any"
                      type="number"
                      value={quantities[item.productId] ?? "0"}
                    />
                  </li>
                );
              })}
            </ul>
            <label className="mt-3 flex flex-col gap-1 text-[12px] font-semibold text-ink">
              Catatan penerimaan
              <textarea
                className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                value={notes}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted">Nilai dalam {currency}.</p>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setReceiveOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy !== null}
                type="submit"
              >
                {busy === "receive" ? "Memproses..." : "Simpan penerimaan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
