"use client";

import { useMemo, useState } from "react";

export type ActivityRow = {
  id: string;
  action: string;
  actorName: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

type Kind = "success" | "neutral" | "warning" | "danger";

const LABELS: Record<string, { text: string; badge: string; kind: Kind }> = {
  "sale.create": { text: "mencatat transaksi penjualan.", badge: "Penjualan", kind: "success" },
  "sale.void": { text: "membatalkan transaksi.", badge: "Void", kind: "danger" },
  "sale.refund": { text: "memproses refund transaksi.", badge: "Refund", kind: "warning" },
  "shift.open": { text: "membuka shift kasir.", badge: "Shift", kind: "success" },
  "shift.close": { text: "menutup shift kasir.", badge: "Shift", kind: "neutral" },
  "shift.cash_in": { text: "mencatat kas masuk.", badge: "Kas", kind: "success" },
  "shift.cash_out": { text: "mencatat kas keluar.", badge: "Kas", kind: "warning" },
  "stock.adjustment": { text: "menyesuaikan stok produk.", badge: "Stok", kind: "warning" },
  "stock.initial": { text: "mencatat stok awal produk.", badge: "Stok", kind: "neutral" },
  "stock.opname": { text: "menyelesaikan stock opname.", badge: "Opname", kind: "neutral" },
  "transfer.create": { text: "membuat transfer stok.", badge: "Transfer", kind: "neutral" },
  "transfer.receive": { text: "menerima transfer stok.", badge: "Transfer", kind: "success" },
  "purchase.create": { text: "membuat purchase order.", badge: "Pembelian", kind: "neutral" },
  "purchase.receive": { text: "menerima barang dari supplier.", badge: "Pembelian", kind: "success" },
  "purchase.cancel": { text: "membatalkan purchase order.", badge: "Pembelian", kind: "danger" },
  "product.create": { text: "menambahkan produk baru.", badge: "Katalog", kind: "neutral" },
  "product.update": { text: "memperbarui produk.", badge: "Katalog", kind: "neutral" },
  "product.archive": { text: "mengarsipkan produk.", badge: "Katalog", kind: "warning" },
  "customer.create": { text: "menambahkan pelanggan.", badge: "Pelanggan", kind: "neutral" },
  "customer.update": { text: "memperbarui pelanggan.", badge: "Pelanggan", kind: "neutral" },
  "supplier.create": { text: "menambahkan supplier.", badge: "Supplier", kind: "neutral" },
  "supplier.update": { text: "memperbarui supplier.", badge: "Supplier", kind: "neutral" },
  "settings.update": { text: "mengubah pengaturan toko.", badge: "Pengaturan", kind: "warning" },
  "branch.create": { text: "menambahkan cabang baru.", badge: "Cabang", kind: "neutral" },
  "branch.update": { text: "memperbarui data cabang.", badge: "Cabang", kind: "neutral" },
  "auth.login.success": { text: "masuk melalui sesi Web.", badge: "Login", kind: "success" },
  "auth.login.failed": { text: "gagal masuk.", badge: "Gagal", kind: "danger" },
  "auth.logout": { text: "keluar dari perangkat ini.", badge: "Logout", kind: "neutral" },
};

function describe(row: ActivityRow) {
  const actor = row.actorName ?? "Sistem";
  const known = LABELS[row.action];
  if (known) return { ...known, text: `${actor} ${known.text}` };
  return {
    text: `${actor} melakukan ${row.action.replaceAll(".", " ")}.`,
    badge: "Aktivitas",
    kind: "neutral" as Kind,
  };
}

const FILTERS = [
  { key: "all" as const, label: "Semua" },
  { key: "sales" as const, label: "Penjualan" },
  { key: "stock" as const, label: "Stok" },
];

export function ActivityPanel({ rows, timeZone }: { rows: ActivityRow[]; timeZone: string }) {
  const [filter, setFilter] = useState<"all" | "sales" | "stock">("all");
  const filtered = useMemo(() => {
    if (filter === "sales") {
      return rows.filter((row) => row.action.startsWith("sale.") || row.action.startsWith("shift."));
    }
    if (filter === "stock") {
      return rows.filter(
        (row) =>
          row.action.startsWith("stock.") ||
          row.action.startsWith("transfer.") ||
          row.action.startsWith("purchase."),
      );
    }
    return rows;
  }, [filter, rows]);

  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-panel border border-line bg-surface p-6 lg:col-span-8"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink" id="activity-heading">
            Aktivitas terbaru
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">Jejak audit operasional cabang ini</p>
        </div>
        <div className="flex items-center rounded-lg border border-line bg-surface-muted p-1 text-[13px]">
          {FILTERS.map((tab) => (
            <button
              aria-pressed={filter === tab.key}
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                filter === tab.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="material-symbols-outlined text-[28px] text-muted">history</span>
          <p className="mt-2 text-sm font-medium text-ink">Belum ada aktivitas</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
            Aktivitas penjualan, stok, dan perubahan data akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((row) => {
            const label = describe(row);
            const date = new Date(row.createdAt);
            const time = new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone,
            }).format(date);
            const badgeClass = {
              success: "bg-success-bg text-success",
              neutral: "bg-moss text-ink",
              warning: "bg-amber-bg text-amber",
              danger: "bg-brick-bg text-brick",
            }[label.kind];
            return (
              <article
                className="-mx-2 flex items-center justify-between rounded px-2 py-3.5 transition-colors hover:bg-paper"
                key={row.id}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="w-16 shrink-0 text-[12px] font-medium text-muted">{time}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moss text-[11px] font-semibold text-forest">
                    {(row.actorName ?? "Sistem")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")}
                  </span>
                  <p className="truncate text-[13px] text-ink">{label.text}</p>
                </div>
                <span
                  className={`ml-2 hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:inline-flex ${badgeClass}`}
                >
                  {label.badge}
                </span>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>Menampilkan {filtered.length} aktivitas terakhir</span>
        <span>Zona waktu {timeZone}</span>
      </div>
    </section>
  );
}
