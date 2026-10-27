"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format/money";

type Supplier = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  unitSymbol: string | null;
};

type Line = {
  productId: string;
  name: string;
  sku: string;
  unitSymbol: string | null;
  quantity: string;
  unitCost: string;
};

export function PurchaseForm({
  branchId,
  branchName,
  suppliers,
  currency,
}: {
  branchId: string;
  branchName: string;
  suppliers: Supplier[];
  currency: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({
        branch: branchId,
        status: "active",
        pageSize: "15",
      });
      if (term.trim()) params.set("q", term.trim());
      fetch(`/api/products?${params.toString()}`, { credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) return [];
          const payload = (await response.json().catch(() => null)) as
            | { data?: Product[] }
            | null;
          return payload?.data ?? [];
        })
        .then(setResults)
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [branchId, term]);

  function addProduct(product: Product) {
    setLines((current) =>
      current.some((line) => line.productId === product.id)
        ? current
        : [
            ...current,
            {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              unitSymbol: product.unitSymbol,
              quantity: "1",
              unitCost: String(product.costPrice),
            },
          ],
    );
    setTerm("");
  }

  const total = lines.reduce(
    (sum, line) => sum + Math.round(Number(line.unitCost) || 0) * (Number(line.quantity) || 0),
    0,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supplierId) {
      setError("Pilih supplier.");
      return;
    }
    if (lines.length === 0) {
      setError("Tambahkan minimal satu produk.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          branchId,
          supplierId,
          notes: notes.trim() || null,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { id?: string }; error?: { message?: string; fields?: Record<string, string> } }
        | null;
      if (!response.ok) {
        const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
        throw new Error(field ?? payload?.error?.message ?? "Gagal membuat purchase order.");
      }
      const id = payload?.data?.id;
      router.push(id ? `/purchases/${id}` : "/purchases");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat purchase order.");
      setBusy(false);
    }
  }

  return (
    <form className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={submit}>
      <div className="space-y-5">
        <section className="rounded-panel border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-ink">Item pesanan</h2>
          <div className="mt-3 rounded border border-line">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted">
                search
              </span>
              <input
                className="h-10 w-full rounded-t border-0 border-b border-line pl-9 pr-3 text-[13px] text-ink focus:outline-none"
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Cari produk untuk ditambahkan"
                type="search"
                value={term}
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {searching ? (
                <p className="px-3 py-2 text-[12px] text-muted">Mencari...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-muted">Produk tidak ditemukan.</p>
              ) : (
                results.map((product) => {
                  const added = lines.some((line) => line.productId === product.id);
                  return (
                    <button
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-paper disabled:opacity-50"
                      disabled={added}
                      key={product.id}
                      onClick={() => addProduct(product)}
                      type="button"
                    >
                      <span>
                        <span className="block font-medium text-ink">{product.name}</span>
                        <span className="block text-[11px] text-muted">{product.sku}</span>
                      </span>
                      <span className="text-[11px] text-secondary">
                        beli {formatMoney(product.costPrice, currency)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="mt-3 text-[12px] text-muted">Belum ada item.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 font-semibold">Produk</th>
                    <th className="w-24 py-2 text-right font-semibold">Qty</th>
                    <th className="w-32 py-2 text-right font-semibold">Harga beli</th>
                    <th className="w-28 py-2 text-right font-semibold">Subtotal</th>
                    <th className="w-8 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr className="border-b border-line last:border-0" key={line.productId}>
                      <td className="py-2">
                        <p className="text-[12px] font-medium text-ink">{line.name}</p>
                        <p className="text-[11px] text-muted">
                          {line.sku} {line.unitSymbol ? `· ${line.unitSymbol}` : ""}
                        </p>
                      </td>
                      <td className="py-2 text-right">
                        <input
                          aria-label={`Jumlah ${line.name}`}
                          className="h-8 w-20 rounded border border-line px-2 text-right text-[12px] text-ink"
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
                          required
                          step="any"
                          type="number"
                          value={line.quantity}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          aria-label={`Harga ${line.name}`}
                          className="h-8 w-28 rounded border border-line px-2 text-right text-[12px] text-ink"
                          min="0"
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.productId === line.productId
                                  ? { ...item, unitCost: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          required
                          step="1"
                          type="number"
                          value={line.unitCost}
                        />
                      </td>
                      <td className="py-2 text-right text-[12px] font-semibold text-ink">
                        {formatMoney(
                          Math.round(Number(line.unitCost) || 0) * (Number(line.quantity) || 0),
                          currency,
                        )}
                      </td>
                      <td className="py-2 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-panel border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-ink">Catatan</h2>
          <textarea
            className="mt-2 w-full rounded-control border border-line px-3 py-2 text-[13px] text-ink focus:border-forest focus:outline-none"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Instruksi pengiriman, termin pembayaran, dll."
            rows={3}
            value={notes}
          />
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-panel border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-ink">Ringkasan</h2>
          <dl className="mt-3 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">Cabang</dt>
              <dd className="font-medium text-ink">{branchName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Item</dt>
              <dd className="font-medium text-ink">{lines.length}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold">
              <dt className="text-ink">Total</dt>
              <dd className="text-forest">{formatMoney(total, currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-panel border border-line bg-surface p-4">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Supplier
            <select
              className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
              onChange={(event) => setSupplierId(event.target.value)}
              required
              value={supplierId}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
          <button
            className="mt-3 h-10 w-full rounded-control bg-forest text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
            disabled={busy || lines.length === 0}
            type="submit"
          >
            {busy ? "Menyimpan..." : "Simpan draft PO"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            PO dapat dipesan ke supplier setelah draft disimpan.
          </p>
        </section>
      </aside>
    </form>
  );
}
