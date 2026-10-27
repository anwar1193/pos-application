"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/format/money";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  unitSymbol: string | null;
  costPrice: number;
  sellingPrice: number;
  promoPrice: number | null;
  taxRate: number | null;
  trackStock: boolean;
  minimumStock: number;
  status: string;
  stock: number;
};

type Category = { id: string; name: string; status: string };
type Unit = { id: string; name: string; symbol: string };

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  unitId: string;
  costPrice: string;
  sellingPrice: string;
  promoPrice: string;
  taxPercent: string;
  trackStock: boolean;
  minimumStock: string;
  status: string;
  initialStock: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  unitId: "",
  costPrice: "0",
  sellingPrice: "0",
  promoPrice: "",
  taxPercent: "",
  trackStock: true,
  minimumStock: "0",
  status: "active",
  initialStock: "0",
};

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: unknown; error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok) {
    const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
    throw new Error(field ?? payload?.error?.message ?? "Permintaan gagal.");
  }
  return payload?.data;
}

export function CatalogClient({
  branchId,
  canManage,
  categories,
  units,
  products,
  currency,
}: {
  branchId: string;
  canManage: boolean;
  categories: Category[];
  units: Unit[];
  products: Product[];
  currency: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [unitForm, setUnitForm] = useState({ name: "", symbol: "" });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      categoryId: product.categoryId ?? "",
      unitId: product.unitId ?? "",
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      promoPrice: product.promoPrice === null ? "" : String(product.promoPrice),
      taxPercent: product.taxRate === null ? "" : String(product.taxRate / 100),
      trackStock: product.trackStock,
      minimumStock: String(product.minimumStock),
      status: product.status,
      initialStock: "0",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        categoryId: form.categoryId || null,
        unitId: form.unitId || null,
        costPrice: Number(form.costPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        promoPrice: form.promoPrice === "" ? null : Number(form.promoPrice) || 0,
        taxRate: form.taxPercent === "" ? null : Math.round((Number(form.taxPercent) || 0) * 100),
        trackStock: form.trackStock,
        minimumStock: Number(form.minimumStock) || 0,
        status: form.status,
        ...(editing ? {} : { initialStock: Number(form.initialStock) || 0 }),
      };
      await request(
        editing
          ? `/api/products/${editing.id}`
          : `/api/products?branch=${encodeURIComponent(branchId)}`,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      setFormOpen(false);
      setNotice(editing ? "Produk diperbarui." : "Produk ditambahkan.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan produk.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Arsipkan ${product.name}? Produk tidak akan muncul di kasir.`)) return;
    try {
      await request(`/api/products/${product.id}`, { method: "DELETE" });
      setNotice("Produk diarsipkan.");
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal mengarsipkan produk.");
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: "activate" | "archive" | "price_adjust") {
    const ids = [...selected];
    if (ids.length === 0) return;
    const body: Record<string, unknown> = { ids, action };
    if (action === "price_adjust") {
      const value = window.prompt("Ubah harga jual sebesar persen (contoh -10 untuk turun 10%):", "-10");
      if (value === null) return;
      const percentage = Number(value);
      if (!Number.isFinite(percentage)) return;
      body.percentage = percentage;
      body.applyTo = "sellingPrice";
    } else if (!window.confirm(`Terapkan aksi ini ke ${ids.length} produk?`)) {
      return;
    }
    try {
      await request("/api/products/bulk", { method: "POST", body: JSON.stringify(body) });
      setSelected(new Set());
      setNotice("Perubahan massal diterapkan.");
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal memproses produk.");
    }
  }

  async function importCsv(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = (await request(
        `/api/products/import?branch=${encodeURIComponent(branchId)}`,
        { method: "POST", body: JSON.stringify({ csv: importText }) },
      )) as { created: number; updated: number; errors: { row: number; message: string }[] };
      setNotice(
        `Impor selesai: ${result.created} dibuat, ${result.updated} diperbarui, ${result.errors.length} gagal.`,
      );
      setImportOpen(false);
      setImportText("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengimpor CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    try {
      await request("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal menambah kategori.");
    }
  }

  async function renameCategory(category: Category) {
    const name = window.prompt("Nama kategori:", category.name);
    if (!name || name === category.name) return;
    try {
      await request(`/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal mengubah kategori.");
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Arsipkan kategori ${category.name}?`)) return;
    try {
      await request(`/api/categories/${category.id}`, { method: "DELETE" });
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal mengarsipkan kategori.");
    }
  }

  async function addUnit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await request("/api/units", { method: "POST", body: JSON.stringify(unitForm) });
      setUnitForm({ name: "", symbol: "" });
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal menambah satuan.");
    }
  }

  async function removeUnit(unit: Unit) {
    if (!window.confirm(`Hapus satuan ${unit.name}?`)) return;
    try {
      await request(`/api/units/${unit.id}`, { method: "DELETE" });
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Gagal menghapus satuan.");
    }
  }

  return (
    <>
      {notice ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-control border border-forest/30 bg-moss px-4 py-2.5 text-[13px] text-forest">
          <span>{notice}</span>
          <button aria-label="Tutup" onClick={() => setNotice(null)} type="button">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : null}

      <section className="mb-5 rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
          <h2 className="text-[15px] font-semibold text-ink">Daftar produk</h2>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="h-9 rounded-control border border-line bg-white px-3 text-[12px] font-semibold text-ink hover:bg-paper"
                onClick={() => setImportOpen(true)}
                type="button"
              >
                Impor CSV
              </button>
              <button
                className="h-9 rounded-control bg-forest px-3 text-[12px] font-semibold text-white hover:bg-forest-hover"
                onClick={openCreate}
                type="button"
              >
                + Produk
              </button>
            </div>
          ) : null}
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-moss/60 px-4 py-2.5">
            <span className="text-[12px] font-semibold text-forest">
              {selected.size} dipilih
            </span>
            <button
              className="h-7 rounded border border-line bg-white px-2 text-[11px] font-semibold text-ink"
              onClick={() => void bulk("activate")}
              type="button"
            >
              Aktifkan
            </button>
            <button
              className="h-7 rounded border border-line bg-white px-2 text-[11px] font-semibold text-ink"
              onClick={() => void bulk("archive")}
              type="button"
            >
              Arsipkan
            </button>
            <button
              className="h-7 rounded border border-line bg-white px-2 text-[11px] font-semibold text-ink"
              onClick={() => void bulk("price_adjust")}
              type="button"
            >
              Sesuaikan harga
            </button>
            <button
              className="text-[11px] text-muted underline"
              onClick={() => setSelected(new Set())}
              type="button"
            >
              Bersihkan
            </button>
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted">
            Tidak ada produk yang cocok. {canManage ? "Tambahkan produk untuk mulai berjualan." : ""}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      aria-label="Pilih semua"
                      checked={selected.size === products.length && products.length > 0}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked ? new Set(products.map((item) => item.id)) : new Set(),
                        )
                      }
                      type="checkbox"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">Kategori</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Harga jual</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Stok</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={product.id}>
                    <td className="px-3 py-2.5">
                      <input
                        aria-label={`Pilih ${product.name}`}
                        checked={selected.has(product.id)}
                        onChange={() => toggle(product.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-ink">{product.name}</p>
                      <p className="text-[11px] text-muted">
                        {product.sku}
                        {product.barcode ? ` · ${product.barcode}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-secondary">
                      {product.categoryName ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px]">
                      <p className="font-semibold text-ink">
                        {formatMoney(product.promoPrice ?? product.sellingPrice, currency)}
                      </p>
                      {product.promoPrice !== null ? (
                        <p className="text-[10px] text-muted line-through">
                          {formatMoney(product.sellingPrice, currency)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px]">
                      <p
                        className={
                          product.trackStock && product.stock <= product.minimumStock
                            ? "font-semibold text-amber"
                            : "text-secondary"
                        }
                      >
                        {product.trackStock ? product.stock : "∞"}{" "}
                        <span className="text-[10px] text-muted">
                          {product.unitSymbol ?? ""}
                        </span>
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          product.status === "active"
                            ? "bg-success-bg text-success"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {product.status === "active" ? "Aktif" : "Arsip"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded px-2 py-1 text-[11px] font-semibold text-forest hover:bg-moss"
                            onClick={() => openEdit(product)}
                            type="button"
                          >
                            Ubah
                          </button>
                          {product.status === "active" ? (
                            <button
                              className="rounded px-2 py-1 text-[11px] font-semibold text-brick hover:bg-brick-bg"
                              onClick={() => void archive(product)}
                              type="button"
                            >
                              Arsip
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-panel border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Kategori</h2>
          </div>
          <ul className="divide-y divide-line">
            {categories.map((category) => (
              <li className="flex items-center justify-between gap-2 px-4 py-2.5" key={category.id}>
                <span className="flex items-center gap-2 text-[13px] text-ink">
                  {category.name}
                  {category.status === "archived" ? (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
                      arsip
                    </span>
                  ) : null}
                </span>
                {canManage ? (
                  <div className="flex gap-1">
                    <button
                      className="rounded px-2 py-1 text-[11px] font-semibold text-forest hover:bg-moss"
                      onClick={() => void renameCategory(category)}
                      type="button"
                    >
                      Ubah
                    </button>
                    {category.status === "active" ? (
                      <button
                        className="rounded px-2 py-1 text-[11px] font-semibold text-brick hover:bg-brick-bg"
                        onClick={() => void removeCategory(category)}
                        type="button"
                      >
                        Arsip
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? (
            <form className="flex gap-2 border-t border-line p-3" onSubmit={addCategory}>
              <input
                className="h-9 flex-1 rounded-control border border-line px-3 text-[13px] text-ink focus:border-forest focus:outline-none"
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Kategori baru"
                required
                value={categoryName}
              />
              <button
                className="h-9 rounded-control bg-ink px-3 text-[12px] font-semibold text-white"
                type="submit"
              >
                Tambah
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-panel border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Satuan</h2>
          </div>
          <ul className="divide-y divide-line">
            {units.map((unit) => (
              <li className="flex items-center justify-between gap-2 px-4 py-2.5" key={unit.id}>
                <span className="text-[13px] text-ink">
                  {unit.name} <span className="text-[11px] text-muted">({unit.symbol})</span>
                </span>
                {canManage ? (
                  <button
                    className="rounded px-2 py-1 text-[11px] font-semibold text-brick hover:bg-brick-bg"
                    onClick={() => void removeUnit(unit)}
                    type="button"
                  >
                    Hapus
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? (
            <form className="flex gap-2 border-t border-line p-3" onSubmit={addUnit}>
              <input
                className="h-9 flex-1 rounded-control border border-line px-3 text-[13px] text-ink focus:border-forest focus:outline-none"
                onChange={(event) => setUnitForm((value) => ({ ...value, name: event.target.value }))}
                placeholder="Nama satuan"
                required
                value={unitForm.name}
              />
              <input
                className="h-9 w-20 rounded-control border border-line px-3 text-[13px] text-ink focus:border-forest focus:outline-none"
                onChange={(event) =>
                  setUnitForm((value) => ({ ...value, symbol: event.target.value }))
                }
                placeholder="Simbol"
                required
                value={unitForm.symbol}
              />
              <button
                className="h-9 rounded-control bg-ink px-3 text-[12px] font-semibold text-white"
                type="submit"
              >
                Tambah
              </button>
            </form>
          ) : null}
        </section>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setFormOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={submitProduct}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {editing ? "Ubah produk" : "Produk baru"}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Nama
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                  required
                  value={form.name}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                SKU
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))}
                  required
                  value={form.sku}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Barcode
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, barcode: event.target.value }))}
                  value={form.barcode}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Kategori
                <select
                  className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, categoryId: event.target.value }))
                  }
                  value={form.categoryId}
                >
                  <option value="">Tanpa kategori</option>
                  {categories
                    .filter((category) => category.status === "active")
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Satuan
                <select
                  className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                  onChange={(event) => setForm((value) => ({ ...value, unitId: event.target.value }))}
                  value={form.unitId}
                >
                  <option value="">Tanpa satuan</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Status
                <select
                  className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                  onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}
                  value={form.status}
                >
                  <option value="active">Aktif</option>
                  <option value="archived">Arsip</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Harga beli
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, costPrice: event.target.value }))
                  }
                  type="number"
                  value={form.costPrice}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Harga jual
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, sellingPrice: event.target.value }))
                  }
                  required
                  type="number"
                  value={form.sellingPrice}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Harga promo
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, promoPrice: event.target.value }))
                  }
                  placeholder="Opsional"
                  type="number"
                  value={form.promoPrice}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Pajak (%)
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, taxPercent: event.target.value }))
                  }
                  placeholder="Ikuti pengaturan"
                  step="0.01"
                  type="number"
                  value={form.taxPercent}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Stok minimum
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  min="0"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, minimumStock: event.target.value }))
                  }
                  type="number"
                  value={form.minimumStock}
                />
              </label>
              {!editing ? (
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                  Stok awal di cabang ini
                  <input
                    className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                    min="0"
                    onChange={(event) =>
                      setForm((value) => ({ ...value, initialStock: event.target.value }))
                    }
                    type="number"
                    value={form.initialStock}
                  />
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
                URL gambar
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={1000}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, imageUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  type="url"
                  value={form.imageUrl}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
                Deskripsi
                <textarea
                  className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, description: event.target.value }))
                  }
                  rows={2}
                  value={form.description}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] font-medium text-secondary sm:col-span-2">
                <input
                  checked={form.trackStock}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, trackStock: event.target.checked }))
                  }
                  type="checkbox"
                />
                Lacak stok produk ini
              </label>
            </div>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? "Menyimpan..." : "Simpan produk"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setImportOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative w-full max-w-lg rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={importCsv}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">Impor produk dari CSV</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Kolom: name, sku, barcode, category, unit, cost_price, selling_price, promo_price,
              tax_rate, minimum_stock, track_stock, status, stock, description. Baris dengan SKU
              yang sudah ada akan diperbarui.
            </p>
            <input
              accept=".csv,text/csv"
              className="mt-3 block w-full text-[12px] text-secondary"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then(setImportText);
              }}
              type="file"
            />
            <textarea
              className="mt-2 w-full rounded-control border border-line px-3 py-2 font-mono text-[11px] text-ink focus:border-forest focus:outline-none"
              onChange={(event) => setImportText(event.target.value)}
              placeholder="name,sku,selling_price&#10;Kopi Susu,KS-001,18000"
              required
              rows={7}
              value={importText}
            />
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setImportOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy || !importText.trim()}
                type="submit"
              >
                {busy ? "Mengimpor..." : "Impor"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
