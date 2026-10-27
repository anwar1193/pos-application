"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatNumber } from "@/lib/format/money";

type ReceiveItem = {
  productId: string;
  productName: string;
  sku: string;
  sentQuantity: number;
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

const LABELS: Record<string, string> = {
  request: "Ajukan",
  approve: "Setujui",
  send: "Kirim",
  cancel: "Batalkan",
};

export function TransferActions({
  id,
  status,
  branchId,
  fromBranchId,
  toBranchId,
}: {
  id: string;
  status: string;
  branchId: string;
  fromBranchId: string;
  toBranchId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [items, setItems] = useState<ReceiveItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isSource = fromBranchId === branchId;
  const isDestination = toBranchId === branchId && !isSource;

  async function act(action: "request" | "approve" | "send" | "cancel") {
    if (action === "cancel" && !window.confirm("Batalkan transfer ini?")) return;
    setBusy(action);
    setError(null);
    try {
      await post(`/api/inventory/transfers/${id}`, { action });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi gagal.");
    } finally {
      setBusy(null);
    }
  }

  async function openReceive() {
    setReceiveOpen(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/transfers/${id}`, {
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { items?: { productId: string; productName: string; sku: string; sentQuantity: number; receivedQuantity: number }[] } }
        | null;
      const rows = (payload?.data?.items ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        sentQuantity: Number(item.sentQuantity),
        receivedQuantity: Number(item.receivedQuantity),
      }));
      setItems(rows);
      setQuantities(
        Object.fromEntries(
          rows.map((row) => [row.productId, String(row.sentQuantity - row.receivedQuantity)]),
        ),
      );
    } catch {
      setError("Gagal memuat detail transfer.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReceive(event: React.FormEvent) {
    event.preventDefault();
    setBusy("receive");
    setError(null);
    try {
      await post(`/api/inventory/transfers/${id}`, {
        action: "receive",
        items: items.map((item) => ({
          productId: item.productId,
          receivedQuantity: Number(quantities[item.productId] ?? 0),
        })),
      });
      setReceiveOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menerima transfer.");
    } finally {
      setBusy(null);
    }
  }

  const canReceive = isDestination && ["in_transit", "partially_received"].includes(status);
  const canRequest = isSource && status === "draft";
  const canApprove = isSource && status === "requested";
  const canSend = isSource && ["requested", "approved"].includes(status);
  const canCancel = isSource && ["draft", "requested", "approved"].includes(status);

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {canRequest ? (
        <button
          className="rounded bg-forest px-2 py-1 text-[11px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("request")}
          type="button"
        >
          {busy === "request" ? "..." : LABELS.request}
        </button>
      ) : null}
      {canApprove ? (
        <button
          className="rounded bg-forest px-2 py-1 text-[11px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("approve")}
          type="button"
        >
          {busy === "approve" ? "..." : LABELS.approve}
        </button>
      ) : null}
      {canSend ? (
        <button
          className="rounded border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-paper disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("send")}
          type="button"
        >
          {busy === "send" ? "..." : LABELS.send}
        </button>
      ) : null}
      {canReceive ? (
        <button
          className="rounded bg-forest px-2 py-1 text-[11px] font-semibold text-white hover:bg-forest-hover"
          onClick={() => void openReceive()}
          type="button"
        >
          Terima
        </button>
      ) : null}
      {canCancel ? (
        <button
          className="rounded px-2 py-1 text-[11px] font-semibold text-brick hover:bg-brick-bg disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void act("cancel")}
          type="button"
        >
          {busy === "cancel" ? "..." : LABELS.cancel}
        </button>
      ) : null}
      {!canRequest && !canApprove && !canSend && !canReceive && !canCancel ? (
        <span className="text-[11px] text-muted">—</span>
      ) : null}
      {error && !receiveOpen ? <span className="text-[11px] text-brick">{error}</span> : null}

      {receiveOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 text-left">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setReceiveOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={submitReceive}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Terima transfer</h2>
            <p className="mt-1 text-[12px] text-muted">
              Masukkan jumlah barang yang benar-benar diterima. Jumlah tidak boleh melebihi yang
              dikirim.
            </p>
            {loading ? (
              <p className="mt-4 text-[12px] text-muted">Memuat...</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded border border-line">
                {items.map((item) => {
                  const remaining = item.sentQuantity - item.receivedQuantity;
                  return (
                    <li className="flex items-center gap-2 px-3 py-2" key={item.productId}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-ink">
                          {item.productName}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {item.sku} · dikirim {formatNumber(item.sentQuantity)} · sisa{" "}
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
            )}
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
                disabled={busy !== null || loading || items.length === 0}
                type="submit"
              >
                {busy === "receive" ? "Memproses..." : "Simpan penerimaan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </span>
  );
}
