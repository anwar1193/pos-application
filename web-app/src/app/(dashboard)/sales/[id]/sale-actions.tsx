"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/format/money";

type RefundItem = {
  id: string;
  productName: string;
  quantity: number;
  refundedQuantity: number;
  lineTotal: number;
  unitPrice: number;
};

type PrintData = {
  receiptNumber: string;
  soldAt: string;
  branchName: string;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  items: { productName: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeTotal: number;
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
    const fields = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
    throw new Error(fields ?? payload?.error?.message ?? "Permintaan gagal.");
  }
}

export function SaleActions({
  saleId,
  status,
  canVoid,
  canRefund,
  refundItems,
  printData,
  currency,
}: {
  saleId: string;
  status: string;
  canVoid: boolean;
  canRefund: boolean;
  refundItems: RefundItem[];
  printData: PrintData;
  currency: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"void" | "refund" | null>(null);
  const [reason, setReason] = useState("");
  const [restoreStock, setRestoreStock] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundable = refundItems
    .map((item) => ({ ...item, remaining: item.quantity - item.refundedQuantity }))
    .filter((item) => item.remaining > 0);
  const canVoidNow = canVoid && status !== "voided" && status !== "refunded" && status !== "partially_refunded";
  const canRefundNow = canRefund && status !== "voided" && refundable.length > 0;

  function open(kind: "void" | "refund") {
    setModal(kind);
    setReason("");
    setRestoreStock(true);
    setError(null);
    const initial: Record<string, string> = {};
    for (const item of refundable) initial[item.id] = "";
    setQuantities(initial);
  }

  async function submitVoid(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(`/api/sales/${saleId}/void`, { reason, restoreStock });
      setModal(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membatalkan transaksi.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const items = refundable
        .map((item) => ({ saleItemId: item.id, quantity: Number(quantities[item.id] ?? 0) }))
        .filter((item) => item.quantity > 0);
      if (items.length === 0) throw new Error("Isi jumlah item yang direfund.");
      await post(`/api/sales/${saleId}/refund`, { reason, restoreStock, items });
      setModal(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memproses refund.");
    } finally {
      setBusy(false);
    }
  }

  function receiptHtml() {
    const rows = printData.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.productName)}<br><small>${item.quantity} x</small></td><td class="right">${formatMoney(item.lineTotal, currency)}</td></tr>`,
      )
      .join("");
    return `<!doctype html><html><head><title>${escapeHtml(printData.receiptNumber)}</title>
      <style>
        body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#111;padding:16px;width:300px}
        h1{font-size:14px;text-align:center;margin:0 0 4px}
        .muted{color:#555;text-align:center;margin:0 0 12px;font-size:11px}
        table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}
        .right{text-align:right}hr{border:none;border-top:1px dashed #999;margin:8px 0}
        .total{font-weight:700;font-size:13px}.center{text-align:center}
      </style></head><body>
      <h1>${escapeHtml(printData.branchName)}</h1>
      <p class="muted">${escapeHtml(printData.receiptNumber)}<br>${new Date(printData.soldAt).toLocaleString("id-ID")}</p>
      <hr><table>${rows}</table><hr>
      <table>
        <tr><td>Subtotal</td><td class="right">${formatMoney(printData.subtotal, currency)}</td></tr>
        <tr><td>Diskon</td><td class="right">-${formatMoney(printData.discountTotal, currency)}</td></tr>
        <tr><td>Pajak</td><td class="right">${formatMoney(printData.taxTotal, currency)}</td></tr>
        <tr class="total"><td>Total</td><td class="right">${formatMoney(printData.grandTotal, currency)}</td></tr>
        <tr><td>Dibayar</td><td class="right">${formatMoney(printData.paidTotal, currency)}</td></tr>
        <tr><td>Kembali</td><td class="right">${formatMoney(printData.changeTotal, currency)}</td></tr>
      </table>
      <hr><p class="center">Terima kasih atas kunjungan Anda</p>
      </body></html>`;
  }

  function print() {
    const win = window.open("", "_blank", "width=380,height=640");
    if (!win) return;
    win.document.write(receiptHtml());
    win.document.close();
    win.focus();
    win.print();
  }

  function receiptText(): string {
    return [
      printData.branchName,
      printData.receiptNumber,
      new Date(printData.soldAt).toLocaleString("id-ID"),
      "",
      ...printData.items.map(
        (item) =>
          `${item.quantity} x ${item.productName} = ${formatMoney(item.lineTotal, currency)}`,
      ),
      "",
      `Subtotal: ${formatMoney(printData.subtotal, currency)}`,
      `Diskon: -${formatMoney(printData.discountTotal, currency)}`,
      `Pajak: ${formatMoney(printData.taxTotal, currency)}`,
      `Total: ${formatMoney(printData.grandTotal, currency)}`,
      `Dibayar: ${formatMoney(printData.paidTotal, currency)}`,
      `Kembali: ${formatMoney(printData.changeTotal, currency)}`,
      "",
      `${window.location.origin}/sales/${saleId}`,
    ].join("\n");
  }

  function download() {
    const blob = new Blob([receiptText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = `struk-${printData.receiptNumber}.txt`;
    anchor.href = url;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resend() {
    const digits = (printData.customerPhone ?? "").replace(/\D/g, "");
    if (!digits) return;
    const phone = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(receiptText())}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function share() {
    const text = receiptText();
    if (navigator.share) {
      await navigator.share({ title: `Struk ${printData.receiptNumber}`, text }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
          onClick={print}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          Cetak
        </button>
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
          onClick={download}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Unduh
        </button>
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
          onClick={() => void share()}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">share</span>
          Bagikan
        </button>
        {printData.customerPhone ? (
          <button
            className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
            onClick={resend}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            Kirim ulang
          </button>
        ) : null}
        {canRefundNow ? (
          <button
            className="flex h-10 items-center gap-2 rounded-control bg-amber px-3 text-[13px] font-semibold text-white hover:bg-[#92400E]"
            onClick={() => open("refund")}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
            Refund
          </button>
        ) : null}
        {canVoidNow ? (
          <button
            className="flex h-10 items-center gap-2 rounded-control border border-brick/30 bg-white px-3 text-[13px] font-semibold text-brick hover:bg-brick-bg"
            onClick={() => open("void")}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            Batalkan
          </button>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setModal(null)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={modal === "void" ? submitVoid : submitRefund}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {modal === "void" ? "Batalkan transaksi" : "Proses refund"}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              {modal === "void"
                ? "Transaksi yang dibatalkan tidak lagi dihitung sebagai penjualan. Tindakan ini tercatat di audit log."
                : "Pilih jumlah item yang dikembalikan. Nilai refund dihitung proporsional dari total item."}
            </p>

            {modal === "refund" ? (
              <div className="mt-3 space-y-2 rounded border border-line p-3">
                {refundable.map((item) => (
                  <div className="flex items-center justify-between gap-2" key={item.id}>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-ink">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-muted">
                        dibeli {item.quantity} · sudah refund {item.refundedQuantity}
                      </p>
                    </div>
                    <input
                      aria-label={`Jumlah refund ${item.productName}`}
                      className="h-8 w-20 rounded border border-line px-2 text-right text-[12px] text-ink focus:border-amber focus:outline-none"
                      max={item.remaining}
                      min="0"
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      step="any"
                      type="number"
                      value={quantities[item.id] ?? ""}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="reason">
              Alasan
            </label>
            <textarea
              className="mt-1 w-full rounded-control border border-line px-3 py-2 text-sm text-ink focus:border-amber focus:outline-none"
              id="reason"
              minLength={3}
              onChange={(event) => setReason(event.target.value)}
              required
              rows={3}
              value={reason}
            />
            <label className="mt-3 flex items-center gap-2 text-[12px] text-secondary">
              <input
                checked={restoreStock}
                onChange={(event) => setRestoreStock(event.target.checked)}
                type="checkbox"
              />
              Kembalikan stok produk
            </label>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setModal(null)}
                type="button"
              >
                Batal
              </button>
              <button
                className={`h-9 rounded-control px-4 text-[13px] font-semibold text-white disabled:opacity-60 ${
                  modal === "void" ? "bg-brick hover:bg-[#911E14]" : "bg-amber hover:bg-[#92400E]"
                }`}
                disabled={busy}
                type="submit"
              >
                {busy ? "Memproses..." : modal === "void" ? "Batalkan transaksi" : "Proses refund"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
