"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/format/money";

type Shift = {
  id: string;
  openedAt: string;
  branchName: string;
  cashierName: string;
  status: string;
  openingAmount: number;
  expectedAmount: number | null;
  actualAmount: number | null;
  difference: number | null;
  cashIn: number;
  cashOut: number;
  transactionCount?: number;
  grossTotal?: number;
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

export function ShiftPanel({
  branchId,
  currency,
  current,
  canManage,
  approvers,
  threshold,
}: {
  branchId: string;
  currency: string;
  current: Shift | null;
  canManage: boolean;
  approvers: { id: string; name: string }[];
  threshold: number;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"open" | "close" | "cash" | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [approvedById, setApprovedById] = useState("");
  const [notes, setNotes] = useState("");
  const [cashType, setCashType] = useState<"in" | "out">("in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const difference = current && actualAmount !== "" ? Number(actualAmount) - current.expectedAmount! : 0;
  const needsApproval = Math.abs(difference) > threshold;

  function reset() {
    setModal(null);
    setOpeningAmount("");
    setActualAmount("");
    setApprovedById("");
    setNotes("");
    setCashAmount("");
    setCashReason("");
    setError(null);
  }

  async function submitOpen(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/shifts", { branchId, openingAmount: Number(openingAmount) || 0 });
      reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuka shift.");
    } finally {
      setBusy(false);
    }
  }

  async function submitClose(event: React.FormEvent) {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/shifts/${current.id}/close`, {
        actualAmount: Number(actualAmount) || 0,
        notes: notes.trim() || null,
        approvedById: needsApproval && approvedById ? approvedById : null,
      });
      reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menutup shift.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCash(event: React.FormEvent) {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/shifts/${current.id}/cash`, {
        type: cashType,
        amount: Number(cashAmount) || 0,
        reason: cashReason,
      });
      reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mencatat kas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {current ? (
        <section className="rounded-panel border border-forest/30 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">
                Shift aktif
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ink">
                {current.branchName} · {current.cashierName}
              </p>
              <p className="text-[12px] text-muted">
                Dibuka {new Date(current.openedAt).toLocaleString("id-ID")}
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-control border border-line bg-white px-3 text-[12px] font-semibold text-ink hover:bg-paper"
                  onClick={() => setModal("cash")}
                  type="button"
                >
                  Kas masuk/keluar
                </button>
                <button
                  className="h-9 rounded-control bg-amber px-3 text-[12px] font-semibold text-white hover:bg-[#92400E]"
                  onClick={() => setModal("close")}
                  type="button"
                >
                  Tutup shift
                </button>
              </div>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Kas awal", current.openingAmount],
              ["Penjualan", current.grossTotal ?? 0],
              ["Kas masuk", current.cashIn],
              ["Kas keluar", current.cashOut],
            ].map(([label, value]) => (
              <div className="rounded border border-line bg-paper px-3 py-2" key={label as string}>
                <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-ink">
                  {formatMoney(Number(value), currency)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] text-secondary">
            Kas seharusnya di drawer:{" "}
            <span className="font-semibold text-ink">
              {formatMoney(current.expectedAmount ?? 0, currency)}
            </span>
            {current.transactionCount !== undefined
              ? ` · ${current.transactionCount} transaksi`
              : ""}
          </p>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface p-4">
          <div>
            <p className="text-[14px] font-semibold text-ink">Belum ada shift terbuka</p>
            <p className="text-[12px] text-muted">
              Buka shift dengan mencatat kas awal untuk mulai menerima transaksi.
            </p>
          </div>
          {canManage ? (
            <button
              className="flex h-9 items-center gap-2 rounded-control bg-forest px-3 text-[12px] font-semibold text-white hover:bg-forest-hover"
              onClick={() => setModal("open")}
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">schedule</span>
              Buka shift
            </button>
          ) : null}
        </section>
      )}

      {modal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={reset}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={
              modal === "open" ? submitOpen : modal === "close" ? submitClose : submitCash
            }
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {modal === "open"
                ? "Buka shift"
                : modal === "close"
                  ? "Tutup shift"
                  : "Kas masuk / keluar"}
            </h2>

            {modal === "open" ? (
              <>
                <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="opening">
                  Kas awal
                </label>
                <input
                  className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
                  id="opening"
                  min="0"
                  onChange={(event) => setOpeningAmount(event.target.value)}
                  required
                  type="number"
                  value={openingAmount}
                />
              </>
            ) : null}

            {modal === "close" && current ? (
              <>
                <p className="mt-2 text-[12px] text-muted">
                  Kas seharusnya {formatMoney(current.expectedAmount ?? 0, currency)}.
                </p>
                <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="actual">
                  Kas aktual di drawer
                </label>
                <input
                  className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
                  id="actual"
                  min="0"
                  onChange={(event) => setActualAmount(event.target.value)}
                  required
                  type="number"
                  value={actualAmount}
                />
                {actualAmount !== "" ? (
                  <p
                    className={`mt-1.5 text-[12px] font-semibold ${
                      difference === 0
                        ? "text-success"
                        : Math.abs(difference) > threshold
                          ? "text-brick"
                          : "text-amber"
                    }`}
                  >
                    Selisih {formatMoney(difference, currency)}
                  </p>
                ) : null}
                {needsApproval ? (
                  approvers.length > 0 ? (
                    <div className="mt-3 rounded border border-amber/40 bg-amber-bg p-2.5">
                      <label className="block text-[12px] font-semibold text-amber" htmlFor="approver">
                        Selisih melebihi {formatMoney(threshold, currency)} — pilih penyetuju
                      </label>
                      <select
                        className="mt-1 h-9 w-full rounded border border-line bg-white px-2 text-[12px] text-ink"
                        id="approver"
                        onChange={(event) => setApprovedById(event.target.value)}
                        required
                        value={approvedById}
                      >
                        <option value="">Pilih penyetuju</option>
                        {approvers.map((approver) => (
                          <option key={approver.id} value={approver.id}>
                            {approver.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="mt-3 rounded border border-brick/30 bg-brick-bg p-2.5 text-[12px] text-brick">
                      Selisih melebihi batas. Minta manajer lain untuk menutup shift ini.
                    </p>
                  )
                ) : null}
                <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="close-notes">
                  Catatan
                </label>
                <textarea
                  className="mt-1 w-full rounded-control border border-line px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
                  id="close-notes"
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  value={notes}
                />
              </>
            ) : null}

            {modal === "cash" ? (
              <>
                <div className="mt-3 flex gap-2">
                  <button
                    className={`h-9 flex-1 rounded-control text-[12px] font-semibold ${
                      cashType === "in"
                        ? "bg-forest text-white"
                        : "border border-line bg-white text-ink"
                    }`}
                    onClick={() => setCashType("in")}
                    type="button"
                  >
                    Kas masuk
                  </button>
                  <button
                    className={`h-9 flex-1 rounded-control text-[12px] font-semibold ${
                      cashType === "out"
                        ? "bg-amber text-white"
                        : "border border-line bg-white text-ink"
                    }`}
                    onClick={() => setCashType("out")}
                    type="button"
                  >
                    Kas keluar
                  </button>
                </div>
                <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="cash-amount">
                  Nominal
                </label>
                <input
                  className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
                  id="cash-amount"
                  min="1"
                  onChange={(event) => setCashAmount(event.target.value)}
                  required
                  type="number"
                  value={cashAmount}
                />
                <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="cash-reason">
                  Alasan
                </label>
                <input
                  className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
                  id="cash-reason"
                  minLength={3}
                  onChange={(event) => setCashReason(event.target.value)}
                  required
                  value={cashReason}
                />
              </>
            ) : null}

            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={reset}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy || (needsApproval && approvers.length > 0 && !approvedById)}
                type="submit"
              >
                {busy ? "Memproses..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
