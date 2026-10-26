"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format/money";

type Branch = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  trackStock: boolean;
  unitSymbol: string | null;
};

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: { id?: string }; error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok) {
    const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
    throw new Error(field ?? payload?.error?.message ?? "Permintaan gagal.");
  }
  return payload?.data;
}

async function searchProducts(branchId: string, q: string): Promise<Product[]> {
  const params = new URLSearchParams({
    branch: branchId,
    status: "active",
    pageSize: "20",
  });
  if (q.trim()) params.set("q", q.trim());
  const response = await fetch(`/api/products?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as { data?: Product[] } | null;
  return (payload?.data ?? []).filter((product) => product.trackStock);
}

function ProductPicker({
  branchId,
  onPick,
  pickedIds,
}: {
  branchId: string;
  onPick: (product: Product) => void;
  pickedIds: Set<string>;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchProducts(branchId, term)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [branchId, term]);

  return (
    <div className="rounded border border-line">
      <input
        className="h-9 w-full rounded-t border-0 border-b border-line px-3 text-[13px] text-ink focus:outline-none"
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Cari produk (nama atau SKU)"
        type="search"
        value={term}
      />
      <div className="max-h-44 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-2 text-[12px] text-muted">Mencari...</p>
        ) : results.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-muted">Produk tidak ditemukan.</p>
        ) : (
          results.map((product) => {
            const picked = pickedIds.has(product.id);
            return (
              <button
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-paper disabled:opacity-50 ${
                  picked ? "bg-moss/60" : ""
                }`}
                disabled={picked}
                key={product.id}
                onClick={() => onPick(product)}
                type="button"
              >
                <span>
                  <span className="block font-medium text-ink">{product.name}</span>
                  <span className="block text-[11px] text-muted">{product.sku}</span>
                </span>
                <span className="text-right text-[11px] text-secondary">
                  stok {formatNumber(Number(product.stock))} {product.unitSymbol ?? ""}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

type Line = { productId: string; name: string; unitSymbol: string | null; quantity: string };

function LinesEditor({
  branchId,
  lines,
  setLines,
}: {
  branchId: string;
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
}) {
  function addLine(item: Product, quantityValue = "1") {
    setLines((current) =>
      current.some((line) => line.productId === item.id)
        ? current
        : [
            ...current,
            {
              productId: item.id,
              name: item.name,
              unitSymbol: item.unitSymbol,
              quantity: quantityValue,
            },
          ],
    );
  }

  return (
    <div className="mt-3">
      <ProductPicker
        branchId={branchId}
        onPick={(item) => addLine(item)}
        pickedIds={new Set(lines.map((line) => line.productId))}
      />
      {lines.length > 0 ? (
        <ul className="mt-2 divide-y divide-line rounded border border-line">
          {lines.map((line) => (
            <li className="flex items-center gap-2 px-3 py-2" key={line.productId}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-ink">{line.name}</span>
                <span className="block text-[11px] text-muted">{line.unitSymbol ?? ""}</span>
              </span>
              <input
                aria-label={`Jumlah ${line.name}`}
                className="h-8 w-24 rounded border border-line px-2 text-right text-[12px] text-ink"
                min="0"
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.productId === line.productId
                        ? { ...item, quantity: event.target.value }
                        : item,
                    ),
                  )
                }
                step="any"
                type="number"
                value={line.quantity}
              />
              <button
                aria-label="Hapus"
                className="text-muted hover:text-brick"
                onClick={() =>
                  setLines((current) =>
                    current.filter((item) => item.productId !== line.productId),
                  )
                }
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted">Belum ada produk dipilih.</p>
      )}
    </div>
  );
}

export function InventoryActions({
  branchId,
  branches,
  canAdjust,
  canOpname,
  canTransfer,
}: {
  branchId: string;
  branches: Branch[];
  canAdjust: boolean;
  canOpname: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"adjust" | "opname" | "transfer" | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [adjustType, setAdjustType] = useState<"adjustment" | "initial">("adjustment");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [toBranchId, setToBranchId] = useState(branches[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setModal(null);
    setProduct(null);
    setQuantity("");
    setReason("");
    setAdjustType("adjustment");
    setLines([]);
    setNotes("");
    setError(null);
    setBusy(false);
  }

  async function submitAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!product) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post("/api/inventory/adjust", {
        branchId,
        productId: product.id,
        quantity: Number(quantity),
        reason,
        type: adjustType,
      });
      reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyesuaikan stok.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOpname(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setError("Tambahkan minimal satu produk.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = (await post("/api/inventory/opname", {
        branchId,
        notes: notes.trim() || null,
        items: lines.map((line) => ({
          productId: line.productId,
          countedQuantity: Number(line.quantity),
        })),
      })) as { id?: string } | undefined;
      reset();
      if (result?.id) router.push(`/inventory/opname/${result.id}`);
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat opname.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTransfer(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setError("Tambahkan minimal satu produk.");
      return;
    }
    if (!toBranchId) {
      setError("Pilih cabang tujuan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post("/api/inventory/transfers", {
        fromBranchId: branchId,
        toBranchId,
        notes: notes.trim() || null,
        items: lines.map((line) => ({
          productId: line.productId,
          requestedQuantity: Number(line.quantity),
        })),
      });
      reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canAdjust ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
          onClick={() => setModal("adjust")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Penyesuaian
        </button>
      ) : null}
      {canOpname ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
          onClick={() => setModal("opname")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">fact_check</span>
          Stock opname
        </button>
      ) : null}
      {canTransfer && branches.length > 0 ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
          onClick={() => setModal("transfer")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
          Transfer
        </button>
      ) : null}

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
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={
              modal === "adjust"
                ? submitAdjust
                : modal === "opname"
                  ? submitOpname
                  : submitTransfer
            }
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {modal === "adjust"
                ? "Penyesuaian stok"
                : modal === "opname"
                  ? "Stock opname baru"
                  : "Transfer stok"}
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              {modal === "adjust"
                ? "Gunakan angka positif untuk menambah dan negatif untuk mengurangi stok."
                : modal === "opname"
                  ? "Masukkan jumlah hasil hitung fisik. Selisih akan diterapkan saat opname diselesaikan."
                  : `Kirim stok dari cabang ini ke cabang lain.`}
            </p>

            {modal === "adjust" ? (
              <>
                <div className="mt-3">
                  {product ? (
                    <div className="flex items-center justify-between rounded border border-line bg-paper px-3 py-2">
                      <span className="text-[13px] font-medium text-ink">
                        {product.name}
                        <span className="block text-[11px] text-muted">
                          {product.sku} · stok {formatNumber(Number(product.stock))}{" "}
                          {product.unitSymbol ?? ""}
                        </span>
                      </span>
                      <button
                        className="text-[11px] font-semibold text-forest underline"
                        onClick={() => setProduct(null)}
                        type="button"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <ProductPicker
                      branchId={branchId}
                      onPick={setProduct}
                      pickedIds={new Set()}
                    />
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                    Jumlah (+/-)
                    <input
                      className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                      onChange={(event) => setQuantity(event.target.value)}
                      required
                      step="any"
                      type="number"
                      value={quantity}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                    Jenis
                    <select
                      className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                      onChange={(event) =>
                        setAdjustType(event.target.value as "adjustment" | "initial")
                      }
                      value={adjustType}
                    >
                      <option value="adjustment">Penyesuaian</option>
                      <option value="initial">Stok awal</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-1 text-[12px] font-semibold text-ink">
                  Alasan
                  <input
                    className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                    minLength={3}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    value={reason}
                  />
                </label>
              </>
            ) : (
              <>
                {modal === "transfer" ? (
                  <label className="mt-3 flex flex-col gap-1 text-[12px] font-semibold text-ink">
                    Cabang tujuan
                    <select
                      className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                      onChange={(event) => setToBranchId(event.target.value)}
                      required
                      value={toBranchId}
                    >
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <LinesEditor branchId={branchId} lines={lines} setLines={setLines} />
                <label className="mt-3 flex flex-col gap-1 text-[12px] font-semibold text-ink">
                  Catatan
                  <textarea
                    className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    value={notes}
                  />
                </label>
                <p className="mt-1 text-[11px] text-muted">
                  Jumlah menggunakan satuan masing-masing produk.
                </p>
              </>
            )}

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
                disabled={busy}
                type="submit"
              >
                {busy ? "Memproses..." : modal === "adjust" ? "Simpan" : "Buat"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
