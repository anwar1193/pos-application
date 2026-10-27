"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allocateProportionally,
  formatMoney,
  roundMoney,
  taxAmount,
} from "@/lib/format/money";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  promoPrice: number | null;
  taxRate: number | null;
  trackStock: boolean;
  unitName: string | null;
  unitSymbol: string | null;
  stock: number;
};

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
  discountAmount: number;
  trackStock: boolean;
  stock: number;
  unitLabel: string;
};

type PaymentLine = {
  key: string;
  method: string;
  amount: string;
  referenceNumber: string;
};

type ShiftInfo = {
  id: string;
  openedAt: string;
  openingAmount: number;
  expectedAmount: number;
  transactionCount: number;
  grossTotal: number;
};

type Customer = { id: string; name: string; phone: string | null };

type ParkedSale = {
  id: string;
  label: string;
  cartPayload: string;
  createdAt: string;
};

type Receipt = {
  id: string;
  receiptNumber: string;
  soldAt: string;
  branchName: string;
  cashierName: string;
  customerName: string | null;
  items: { productName: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeTotal: number;
  notes: string | null;
  payments: { method: string; amount: number; referenceNumber: string | null }[];
};

type ParkedPayload = {
  lines: CartLine[];
  transactionDiscount: number;
  customer: Customer | null;
  notes: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok) {
    const fieldMessage = body?.error?.fields ? Object.values(body.error.fields)[0] : undefined;
    throw new Error(fieldMessage ?? body?.error?.message ?? "Terjadi kesalahan.");
  }
  return body?.data as T;
}

function computeTotals(lines: CartLine[], transactionDiscount: number) {
  const prepared = lines.map((line) => {
    const gross = roundMoney(line.unitPrice * line.quantity);
    const discount = Math.min(Math.max(0, roundMoney(line.discountAmount)), gross);
    return { ...line, base: gross - discount, discount };
  });
  const baseSum = prepared.reduce((sum, line) => sum + line.base, 0);
  const discount = Math.min(Math.max(0, roundMoney(transactionDiscount)), baseSum);
  const shares = allocateProportionally(
    discount,
    prepared.map((line) => line.base),
  );
  let taxTotal = 0;
  let grandTotal = 0;
  const detailed = prepared.map((line, index) => {
    const taxable = line.base - (shares[index] ?? 0);
    const tax = taxAmount(taxable, line.taxRate);
    taxTotal += tax;
    grandTotal += taxable + tax;
    return { ...line, tax, lineTotal: taxable + tax };
  });
  return {
    lines: detailed,
    subtotal: prepared.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    itemDiscountTotal: prepared.reduce((sum, line) => sum + line.discount, 0),
    transactionDiscount: discount,
    taxTotal,
    grandTotal: roundMoney(grandTotal),
  };
}

export function PosClient({
  branchId,
  branchName,
  currency,
  defaultTaxRate,
  paymentMethods,
  permissions,
  shift,
}: {
  branchId: string;
  branchName: string;
  currency: string;
  defaultTaxRate: number;
  paymentMethods: { code: string; name: string }[];
  permissions: string[];
  shift: ShiftInfo | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [transactionDiscount, setTransactionDiscount] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([
    { key: "p1", method: paymentMethods[0]?.code ?? "cash", amount: "", referenceNumber: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [parked, setParked] = useState<ParkedSale[]>([]);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [customerBusy, setCustomerBusy] = useState(false);
  const idempotencyRef = useRef<string>("");
  const canManageCustomers = permissions.includes("customer.manage");

  const totals = useMemo(
    () => computeTotals(lines, Number(transactionDiscount || 0)),
    [lines, transactionDiscount],
  );

  const loadProducts = useCallback(
    async (term: string) => {
      setSearching(true);
      try {
        const data = await api<Product[]>(
          `/api/products/lookup?branch=${encodeURIComponent(branchId)}&q=${encodeURIComponent(term)}&limit=30`,
        );
        setProducts(data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal memuat produk.");
      } finally {
        setSearching(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProducts(query.trim());
    }, query ? 220 : 0);
    return () => clearTimeout(timer);
  }, [query, loadProducts]);

  const loadParked = useCallback(async () => {
    try {
      setParked(
        await api<ParkedSale[]>(`/api/sales/parked?branch=${encodeURIComponent(branchId)}`),
      );
    } catch {
      // Parked carts are supplementary; ignore load failures.
    }
  }, [branchId]);

  useEffect(() => {
    void loadParked();
  }, [loadParked]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void api<Customer[]>(`/api/customers/search?q=${encodeURIComponent(customerQuery.trim())}`)
        .then(setCustomerResults)
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  function addProduct(product: Product) {
    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (product.trackStock && existing.quantity + 1 > product.stock) {
          setError(`Stok ${product.name} hanya ${product.stock}.`);
          return current;
        }
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      if (product.trackStock && product.stock <= 0) {
        setError(`${product.name} tidak memiliki stok di cabang ini.`);
        return current;
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.promoPrice ?? product.sellingPrice,
          taxRate: product.taxRate ?? defaultTaxRate,
          quantity: 1,
          discountAmount: 0,
          trackStock: product.trackStock,
          stock: product.stock,
          unitLabel: product.unitSymbol ?? product.unitName ?? "pcs",
        },
      ];
    });
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) => (line.productId === productId ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  function changeQuantity(line: CartLine, next: number) {
    if (!Number.isFinite(next) || next <= 0) return;
    if (line.trackStock && next > line.stock) {
      setError(`Stok ${line.name} hanya ${line.stock}.`);
      return;
    }
    updateLine(line.productId, { quantity: next });
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    const exact = products.find(
      (product) => product.barcode === term || product.sku.toLowerCase() === term.toLowerCase(),
    );
    if (exact) {
      addProduct(exact);
      setQuery("");
      return;
    }
    void loadProducts(term).then(() => {
      setProducts((current) => {
        if (current.length === 1) addProduct(current[0]!);
        return current;
      });
    });
  }

  function addPayment() {
    setPayments((current) => [
      ...current,
      {
        key: `p${Date.now()}`,
        method: paymentMethods[0]?.code ?? "cash",
        amount: "",
        referenceNumber: "",
      },
    ]);
  }

  function updatePayment(key: string, patch: Partial<PaymentLine>) {
    setPayments((current) =>
      current.map((payment) => (payment.key === key ? { ...payment, ...patch } : payment)),
    );
  }

  const effectivePayments = useMemo(() => {
    if (payments.length === 1 && payments[0]!.amount.trim() === "") {
      return [{ ...payments[0]!, amount: String(totals.grandTotal) }];
    }
    return payments;
  }, [payments, totals.grandTotal]);

  const paidTotal = effectivePayments.reduce(
    (sum, payment) => sum + Math.max(0, roundMoney(Number(payment.amount) || 0)),
    0,
  );
  const cashPaid = effectivePayments
    .filter((payment) => payment.method === "cash" || payment.method === "tunai")
    .reduce((sum, payment) => sum + Math.max(0, roundMoney(Number(payment.amount) || 0)), 0);
  const changeTotal = Math.max(0, cashPaid - Math.max(0, totals.grandTotal - (paidTotal - cashPaid)));
  const remaining = Math.max(0, totals.grandTotal - paidTotal);

  async function checkout() {
    setError(null);
    if (lines.length === 0) {
      setError("Keranjang masih kosong.");
      return;
    }
    if (!shift) {
      setShiftOpen(true);
      return;
    }
    if (paidTotal < totals.grandTotal) {
      setError("Pembayaran masih kurang dari total transaksi.");
      return;
    }
    setBusy(true);
    try {
      if (!idempotencyRef.current) idempotencyRef.current = crypto.randomUUID();
      const result = await api<{ saleId: string; receiptNumber: string }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          customerId: customer?.id ?? null,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            discountAmount: line.discountAmount || 0,
          })),
          discountAmount: Number(transactionDiscount || 0) || 0,
          notes: notes.trim() || null,
          payments: effectivePayments.map((payment) => ({
            method: payment.method,
            amount: Number(payment.amount) || 0,
            referenceNumber: payment.referenceNumber.trim() || null,
          })),
          idempotencyKey: idempotencyRef.current,
        }),
      });
      idempotencyRef.current = "";
      const detail = await api<Receipt>(`/api/sales/${result.saleId}`);
      setReceipt(detail);
      setLines([]);
      setTransactionDiscount("");
      setNotes("");
      setCustomer(null);
      setCustomerQuery("");
      setPayments([
        { key: "p1", method: paymentMethods[0]?.code ?? "cash", amount: "", referenceNumber: "" },
      ]);
      void loadProducts("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaksi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function parkCart() {
    if (lines.length === 0) {
      setError("Keranjang masih kosong.");
      return;
    }
    const label = window.prompt("Nama keranjang tersimpan:", customer?.name || "Pesanan");
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      const payload: ParkedPayload = {
        lines,
        transactionDiscount: Number(transactionDiscount || 0) || 0,
        customer,
        notes,
      };
      await api("/api/sales/parked", {
        method: "POST",
        body: JSON.stringify({ branchId, label, cartPayload: JSON.stringify(payload) }),
      });
      setLines([]);
      setTransactionDiscount("");
      setNotes("");
      setCustomer(null);
      await loadParked();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan keranjang.");
    } finally {
      setBusy(false);
    }
  }

  async function resumeParked(item: ParkedSale) {
    try {
      const payload = JSON.parse(item.cartPayload) as ParkedPayload;
      if (!Array.isArray(payload.lines)) throw new Error("Data keranjang tidak valid.");
      setLines(payload.lines);
      setTransactionDiscount(payload.transactionDiscount ? String(payload.transactionDiscount) : "");
      setCustomer(payload.customer ?? null);
      setNotes(payload.notes ?? "");
      setParkedOpen(false);
      await api(`/api/sales/parked/${item.id}`, { method: "DELETE" });
      await loadParked();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuka keranjang.");
    }
  }

  async function openShift(event: React.FormEvent) {
    event.preventDefault();
    setShiftBusy(true);
    setShiftError(null);
    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({ branchId, openingAmount: Number(openingAmount) || 0 }),
      });
      setShiftOpen(false);
      router.refresh();
    } catch (cause) {
      setShiftError(cause instanceof Error ? cause.message : "Gagal membuka shift.");
    } finally {
      setShiftBusy(false);
    }
  }

  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!newCustomer.name.trim()) return;
    setCustomerBusy(true);
    try {
      const created = await api<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || null }),
      });
      setCustomer(created);
      setCustomerCreateOpen(false);
      setNewCustomer({ name: "", phone: "" });
      setCustomerResults([]);
      setCustomerQuery("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menambah pelanggan.");
    } finally {
      setCustomerBusy(false);
    }
  }

  function printReceipt() {
    if (!receipt) return;
    const win = window.open("", "_blank", "width=380,height=640");
    if (!win) return;
    const rows = receipt.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.productName)}<br><small>${item.quantity} x</small></td><td class="right">${formatMoney(item.lineTotal, currency)}</td></tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(receipt.receiptNumber)}</title>
      <style>
        body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#111;padding:16px;width:300px}
        h1{font-size:14px;text-align:center;margin:0 0 4px}
        .muted{color:#555;text-align:center;margin:0 0 12px;font-size:11px}
        table{width:100%;border-collapse:collapse}
        td{padding:3px 0;vertical-align:top}
        .right{text-align:right}
        hr{border:none;border-top:1px dashed #999;margin:8px 0}
        .total{font-weight:700;font-size:13px}
        .center{text-align:center}
      </style></head><body>
      <h1>${escapeHtml(receipt.branchName)}</h1>
      <p class="muted">${escapeHtml(receipt.receiptNumber)}<br>${new Date(receipt.soldAt).toLocaleString("id-ID")}</p>
      <hr><table>${rows}</table><hr>
      <table>
        <tr><td>Subtotal</td><td class="right">${formatMoney(receipt.subtotal, currency)}</td></tr>
        <tr><td>Diskon</td><td class="right">-${formatMoney(receipt.discountTotal, currency)}</td></tr>
        <tr><td>Pajak</td><td class="right">${formatMoney(receipt.taxTotal, currency)}</td></tr>
        <tr class="total"><td>Total</td><td class="right">${formatMoney(receipt.grandTotal, currency)}</td></tr>
        <tr><td>Dibayar</td><td class="right">${formatMoney(receipt.paidTotal, currency)}</td></tr>
        <tr><td>Kembali</td><td class="right">${formatMoney(receipt.changeTotal, currency)}</td></tr>
      </table>
      <hr><p class="center">Terima kasih atas kunjungan Anda</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function shareReceipt() {
    if (!receipt) return;
    const text = `${receipt.branchName} · ${receipt.receiptNumber}\nTotal: ${formatMoney(
      receipt.grandTotal,
      currency,
    )}\n${window.location.origin}/sales/${receipt.receiptNumber}`;
    if (navigator.share) {
      void navigator.share({ title: `Struk ${receipt.receiptNumber}`, text }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(text);
    }
  }

  const canPark = permissions.includes("sale.create");

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Layar Kasir</p>
          <h1 className="text-[28px] font-semibold leading-8 tracking-tight text-ink">
            Transaksi Baru
          </h1>
          <p className="mt-1 text-[13px] text-muted">{branchName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shift ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-success-bg px-3 py-1.5 text-[12px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Shift terbuka · {formatMoney(shift.openingAmount, currency)} kas awal
            </span>
          ) : (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-control bg-amber px-3 text-[13px] font-semibold text-white hover:bg-[#92400E]"
              onClick={() => setShiftOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              Buka shift
            </button>
          )}
          {canPark ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
              onClick={() => setParkedOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">inventory</span>
              Tersimpan ({parked.length})
            </button>
          ) : null}
        </div>
      </header>

      {!shift ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-panel border border-amber/40 bg-amber-bg px-4 py-3 text-[13px] text-amber">
          <span className="material-symbols-outlined text-[18px]">info</span>
          Buka shift terlebih dahulu agar transaksi tercatat pada rekonsiliasi kas.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-control border border-brick/30 bg-brick-bg px-4 py-2.5 text-[13px] text-brick">
          <span>{error}</span>
          <button aria-label="Tutup" onClick={() => setError(null)} type="button">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <form className="mb-4 flex gap-2" onSubmit={onSearchSubmit}>
            <div className="relative flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted">
                barcode_scanner
              </span>
              <input
                autoFocus
                className="h-12 w-full rounded-control border border-line bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Scan barcode atau cari nama / SKU"
                type="search"
                value={query}
              />
            </div>
            <button
              className="h-12 rounded-control bg-ink px-5 text-sm font-semibold text-white hover:bg-black"
              type="submit"
            >
              Cari
            </button>
          </form>

          {searching && products.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="h-28 animate-pulse rounded-panel bg-surface-muted" key={index} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-panel border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-line-strong">search_off</span>
              <p className="mt-2 text-sm font-semibold text-ink">Produk tidak ditemukan</p>
              <p className="mt-1 text-[13px] text-muted">
                Coba kata kunci lain, atau tambahkan produk di menu Produk.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const price = product.promoPrice ?? product.sellingPrice;
                const out = product.trackStock && product.stock <= 0;
                return (
                  <button
                    className="flex min-h-[112px] flex-col justify-between rounded-panel border border-line bg-surface p-3 text-left transition-colors hover:border-forest hover:bg-moss/40 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={out}
                    key={product.id}
                    onClick={() => addProduct(product)}
                    type="button"
                  >
                    <div>
                      <p className="line-clamp-2 text-[13px] font-semibold leading-4 text-ink">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{product.sku}</p>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-bold text-forest">
                          {formatMoney(price, currency)}
                        </p>
                        {product.promoPrice !== null ? (
                          <p className="text-[10px] text-muted line-through">
                            {formatMoney(product.sellingPrice, currency)}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          out
                            ? "bg-brick-bg text-brick"
                            : product.trackStock
                              ? "bg-surface-muted text-secondary"
                              : "bg-moss text-forest"
                        }`}
                      >
                        {product.trackStock ? `${product.stock} ${product.unitSymbol ?? ""}` : "Non-stok"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex flex-col rounded-panel border border-line bg-surface xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Keranjang</h2>
            <span className="text-[12px] text-muted">{lines.length} produk</span>
          </div>

          <div className="min-h-[120px] flex-1 overflow-y-auto px-4 py-3">
            {lines.length === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-[36px] text-line-strong">
                  shopping_cart
                </span>
                <p className="mt-1 text-[13px] font-medium text-muted">Keranjang kosong</p>
                <p className="text-[12px] text-muted">Pilih produk untuk memulai transaksi.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {lines.map((line) => (
                  <li className="py-3 first:pt-0" key={line.productId}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{line.name}</p>
                        <p className="text-[11px] text-muted">
                          {formatMoney(line.unitPrice, currency)} / {line.unitLabel}
                        </p>
                      </div>
                      <button
                        aria-label={`Hapus ${line.name}`}
                        className="text-muted hover:text-brick"
                        onClick={() => removeLine(line.productId)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[17px]">close</span>
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded border border-line">
                        <button
                          aria-label="Kurangi"
                          className="flex h-7 w-7 items-center justify-center text-ink hover:bg-paper"
                          onClick={() => changeQuantity(line, line.quantity - 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[15px]">remove</span>
                        </button>
                        <input
                          aria-label={`Jumlah ${line.name}`}
                          className="h-7 w-10 border-x border-line text-center text-[12px] font-semibold text-ink focus:outline-none"
                          min="0"
                          onChange={(event) =>
                            changeQuantity(line, Number(event.target.value) || 0)
                          }
                          type="number"
                          value={line.quantity}
                        />
                        <button
                          aria-label="Tambah"
                          className="flex h-7 w-7 items-center justify-center text-ink hover:bg-paper"
                          onClick={() => changeQuantity(line, line.quantity + 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                        </button>
                      </div>
                      <span className="text-[13px] font-semibold text-ink">
                        {formatMoney(line.unitPrice * line.quantity - line.discountAmount, currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <label className="text-[10px] text-muted" htmlFor={`disc-${line.productId}`}>
                        Diskon item
                      </label>
                      <input
                        className="h-7 w-24 rounded border border-line px-2 text-right text-[11px] text-ink focus:border-amber focus:outline-none"
                        id={`disc-${line.productId}`}
                        min="0"
                        onChange={(event) =>
                          updateLine(line.productId, {
                            discountAmount: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        placeholder="0"
                        type="number"
                        value={line.discountAmount || ""}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-[12px] font-medium text-secondary" htmlFor="tx-discount">
                Diskon transaksi
              </label>
              <input
                className="h-8 w-32 rounded border border-line px-2 text-right text-[12px] text-ink focus:border-amber focus:outline-none"
                id="tx-discount"
                min="0"
                onChange={(event) => setTransactionDiscount(event.target.value)}
                placeholder="0"
                type="number"
                value={transactionDiscount}
              />
            </div>

            <div className="mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-muted">person</span>
              {customer ? (
                <span className="flex flex-1 items-center justify-between rounded bg-moss px-2 py-1 text-[12px] text-forest">
                  <span className="truncate font-semibold">{customer.name}</span>
                  <button
                    aria-label="Hapus pelanggan"
                    onClick={() => setCustomer(null)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                </span>
              ) : (
                <div className="relative flex-1">
                  <input
                    className="h-8 w-full rounded border border-line px-2 text-[12px] text-ink focus:border-forest focus:outline-none"
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="Cari pelanggan (opsional)"
                    value={customerQuery}
                  />
                  {customerQuery.trim().length >= 2 ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded border border-line bg-surface shadow-overlay">
                      {customerResults.map((item) => (
                        <button
                          className="block w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-paper"
                          key={item.id}
                          onClick={() => {
                            setCustomer(item);
                            setCustomerQuery("");
                            setCustomerResults([]);
                          }}
                          type="button"
                        >
                          {item.name}
                          {item.phone ? ` · ${item.phone}` : ""}
                        </button>
                      ))}
                      {canManageCustomers ? (
                        <button
                          className="flex w-full items-center gap-1 border-t border-line px-3 py-2 text-left text-[12px] font-semibold text-forest hover:bg-paper"
                          onClick={() => {
                            setNewCustomer({ name: customerQuery.trim(), phone: "" });
                            setCustomerCreateOpen(true);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[15px]">person_add</span>
                          Tambah &quot;{customerQuery.trim()}&quot;
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <textarea
              className="mb-3 w-full rounded border border-line px-2 py-1.5 text-[12px] text-ink placeholder:text-muted focus:border-forest focus:outline-none"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Catatan transaksi (opsional)"
              rows={2}
              value={notes}
            />

            <dl className="space-y-1 border-t border-line pt-3 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-ink">{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Diskon</dt>
                <dd className="text-ink">
                  -{formatMoney(totals.itemDiscountTotal + totals.transactionDiscount, currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Pajak</dt>
                <dd className="text-ink">{formatMoney(totals.taxTotal, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-bold">
                <dt className="text-ink">Total</dt>
                <dd className="text-forest">{formatMoney(totals.grandTotal, currency)}</dd>
              </div>
            </dl>

            <div className="mt-3 space-y-2">
              {payments.map((payment) => (
                <div className="rounded border border-line p-2" key={payment.key}>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Metode pembayaran"
                      className="h-8 flex-1 rounded border border-line bg-white px-1.5 text-[12px] text-ink focus:border-forest focus:outline-none"
                      onChange={(event) => updatePayment(payment.key, { method: event.target.value })}
                      value={payment.method}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.code} value={method.code}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Jumlah pembayaran"
                      className="h-8 w-28 rounded border border-line px-2 text-right text-[12px] text-ink focus:border-forest focus:outline-none"
                      inputMode="numeric"
                      onChange={(event) => updatePayment(payment.key, { amount: event.target.value })}
                      placeholder={String(totals.grandTotal)}
                      type="number"
                      value={payment.amount}
                    />
                    {payments.length > 1 ? (
                      <button
                        aria-label="Hapus pembayaran"
                        className="text-muted hover:text-brick"
                        onClick={() =>
                          setPayments((current) =>
                            current.filter((item) => item.key !== payment.key),
                          )
                        }
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    ) : null}
                  </div>
                  {payment.method !== "cash" ? (
                    <input
                      className="mt-1.5 h-7 w-full rounded border border-line px-2 text-[11px] text-ink focus:border-forest focus:outline-none"
                      onChange={(event) =>
                        updatePayment(payment.key, { referenceNumber: event.target.value })
                      }
                      placeholder="No. referensi (opsional)"
                      value={payment.referenceNumber}
                    />
                  ) : null}
                </div>
              ))}
              <div className="flex items-center justify-between text-[12px]">
                <button
                  className="flex items-center gap-1 font-semibold text-forest hover:underline"
                  onClick={addPayment}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Pembayaran terpisah
                </button>
                {remaining > 0 ? (
                  <span className="font-medium text-amber">
                    Kurang {formatMoney(remaining, currency)}
                  </span>
                ) : (
                  <span className="font-medium text-success">
                    Kembali {formatMoney(changeTotal, currency)}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-control border border-line bg-white text-[13px] font-semibold text-ink hover:bg-paper disabled:opacity-50"
                disabled={busy || lines.length === 0 || !canPark}
                onClick={parkCart}
                type="button"
              >
                Simpan
              </button>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-control bg-forest text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-50"
                disabled={busy || lines.length === 0}
                onClick={checkout}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span>
                {busy ? "Memproses..." : "Bayar"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {receipt ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup struk"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setReceipt(null)}
            type="button"
          />
          <div
            aria-modal="true"
            className="relative w-full max-w-sm rounded-panel border border-line bg-surface p-5 shadow-overlay"
            role="dialog"
          >
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
                <span className="material-symbols-outlined text-[26px]">check</span>
              </span>
              <h2 className="mt-2 text-lg font-semibold text-ink">Transaksi berhasil</h2>
              <p className="text-[13px] text-muted">{receipt.receiptNumber}</p>
            </div>
            <dl className="mt-4 space-y-1 rounded border border-line bg-paper p-3 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">Total</dt>
                <dd className="font-semibold text-ink">
                  {formatMoney(receipt.grandTotal, currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Dibayar</dt>
                <dd className="text-ink">{formatMoney(receipt.paidTotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Kembali</dt>
                <dd className="text-ink">{formatMoney(receipt.changeTotal, currency)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-control bg-forest text-sm font-semibold text-white hover:bg-forest-hover"
                onClick={printReceipt}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Cetak struk
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-line bg-white text-[13px] font-semibold text-ink hover:bg-paper"
                  onClick={shareReceipt}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[17px]">share</span>
                  Bagikan
                </button>
                <Link
                  className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-line bg-white text-[13px] font-semibold text-ink hover:bg-paper"
                  href={`/sales/${receipt.id}`}
                  onClick={() => setReceipt(null)}
                >
                  <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                  Detail
                </Link>
              </div>
              <button
                className="h-9 rounded-control text-[13px] font-medium text-muted hover:bg-surface-muted"
                onClick={() => setReceipt(null)}
                type="button"
              >
                Transaksi baru
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {parkedOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setParkedOpen(false)}
            type="button"
          />
          <div
            aria-modal="true"
            className="relative w-full max-w-md rounded-panel border border-line bg-surface p-5 shadow-overlay"
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Keranjang tersimpan</h2>
            <p className="mt-1 text-[13px] text-muted">
              Lanjutkan transaksi yang tertunda di cabang ini.
            </p>
            {parked.length === 0 ? (
              <p className="mt-6 rounded border border-dashed border-line-strong p-6 text-center text-[13px] text-muted">
                Belum ada keranjang tersimpan.
              </p>
            ) : (
              <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
                {parked.map((item) => (
                  <li className="flex items-center justify-between gap-3 py-2.5" key={item.id}>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink">{item.label}</p>
                      <p className="text-[11px] text-muted">
                        {new Date(item.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <button
                      className="h-8 shrink-0 rounded-control bg-forest px-3 text-[12px] font-semibold text-white hover:bg-forest-hover"
                      onClick={() => void resumeParked(item)}
                      type="button"
                    >
                      Lanjutkan
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="mt-4 h-9 w-full rounded-control border border-line text-[13px] font-semibold text-ink hover:bg-paper"
              onClick={() => setParkedOpen(false)}
              type="button"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}

      {shiftOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setShiftOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative w-full max-w-sm rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={openShift}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Buka shift kasir</h2>
            <p className="mt-1 text-[13px] text-muted">
              Masukkan kas awal fisik di drawer sebelum mulai berjualan.
            </p>
            <label className="mt-4 block text-[12px] font-semibold text-ink" htmlFor="opening">
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
            {shiftError ? <p className="mt-2 text-[12px] text-brick">{shiftError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setShiftOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={shiftBusy}
                type="submit"
              >
                {shiftBusy ? "Membuka..." : "Buka shift"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {customerCreateOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setCustomerCreateOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative w-full max-w-sm rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={createCustomer}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Pelanggan baru</h2>
            <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="cust-name">
              Nama
            </label>
            <input
              className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
              id="cust-name"
              onChange={(event) => setNewCustomer((value) => ({ ...value, name: event.target.value }))}
              required
              value={newCustomer.name}
            />
            <label className="mt-3 block text-[12px] font-semibold text-ink" htmlFor="cust-phone">
              Telepon
            </label>
            <input
              className="mt-1 h-10 w-full rounded-control border border-line px-3 text-sm text-ink focus:border-forest focus:outline-none"
              id="cust-phone"
              onChange={(event) =>
                setNewCustomer((value) => ({ ...value, phone: event.target.value }))
              }
              value={newCustomer.phone}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setCustomerCreateOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={customerBusy}
                type="submit"
              >
                {customerBusy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
