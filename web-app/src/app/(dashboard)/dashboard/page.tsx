import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getDashboardSummary } from "@/lib/dashboard/service";
import { formatDateLong, formatTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { ActivityPanel } from "./activity-panel";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  completed: { label: "Selesai", className: "bg-success-bg text-success" },
  voided: { label: "Dibatalkan", className: "bg-brick-bg text-brick" },
  refunded: { label: "Refund", className: "bg-amber-bg text-amber" },
  partially_refunded: { label: "Refund sebagian", className: "bg-amber-bg text-amber" },
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Tunai",
  tunai: "Tunai",
  card: "Kartu",
  transfer: "Transfer",
  qr: "QRIS",
  manual: "Manual",
};

function deltaLabel(value: number | null) {
  if (value === null) return "tanpa data pembanding";
  if (value === 0) return "sama dengan kemarin";
  return `${value > 0 ? "+" : ""}${value}% vs kemarin`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = typeof params.branch === "string" ? params.branch : undefined;
  const session = await requirePagePermission("dashboard.view", "/dashboard");
  const summary = await getDashboardSummary(session, { branchId });
  const currency = summary.organization.currency;
  const canSell = session.permissions.includes(PERMISSIONS.saleCreate);
  const canReport = session.permissions.includes(PERMISSIONS.reportView);
  const now = new Date();
  const timeZoneLabel =
    new Intl.DateTimeFormat("id-ID", {
      timeZone: session.organization.timezone,
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? session.organization.timezone;

  const activityRows = summary.recentActivity.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actorName,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
  }));

  const stats = [
    {
      label: "Penjualan bersih",
      value: formatMoney(summary.today.net, currency),
      icon: "payments",
      caption: `${formatMoney(summary.today.gross, currency)} kotor`,
      footer: deltaLabel(summary.comparison.grossPercent),
      footerIcon: "trending_up",
      tone: (summary.comparison.grossPercent ?? 0) >= 0 ? "text-success" : "text-brick",
    },
    {
      label: "Transaksi",
      value: formatNumber(summary.today.transactions, 0),
      icon: "receipt_long",
      caption: `${formatNumber(summary.today.itemsSold, 2)} item terjual`,
      footer: deltaLabel(summary.comparison.transactionsPercent),
      footerIcon: "receipt",
      tone: (summary.comparison.transactionsPercent ?? 0) >= 0 ? "text-success" : "text-brick",
    },
    {
      label: "Rata-rata / transaksi",
      value: formatMoney(summary.today.average, currency),
      icon: "calculate",
      caption: "nilai belanja rata-rata",
      footer: `${formatMoney(summary.today.refunds, currency)} refund hari ini`,
      footerIcon: "undo",
      tone: summary.today.refunds > 0 ? "text-amber" : "text-muted",
    },
    {
      label: "Shift aktif",
      value: formatNumber(summary.activeShifts.length, 0),
      icon: "badge",
      caption: summary.branch?.name ?? "cabang utama",
      footer:
        summary.activeShifts.length > 0
          ? summary.activeShifts.map((shift) => shift.cashierName).join(", ")
          : "belum ada kasir membuka shift",
      footerIcon: "person",
      tone: "text-muted",
    },
  ];

  return (
    <div className="mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">
            Ringkasan Operasional
          </p>
          <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">Dashboard</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-medium text-ink">
              Selamat datang, {session.user.name.split(/\s+/)[0]}.
            </p>
            <span className="text-line-strong">•</span>
            <p className="text-[15px] text-muted">
              Kinerja {summary.branch?.name ?? session.organization.name} hari ini.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start rounded-lg border border-line bg-surface px-3.5 py-2 md:self-auto">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-success">
              Data langsung
            </span>
          </div>
          <div className="h-3.5 w-px bg-line" />
          <div className="flex items-center gap-1.5 text-muted">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span className="text-[13px] text-ink">
              {formatDateLong(now, session.organization.timezone)} ·{" "}
              {formatTime(now, session.organization.timezone)} {timeZoneLabel}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-label="Statistik penjualan hari ini"
        className="mb-8 w-full overflow-hidden rounded-panel border border-line bg-surface"
      >
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {stats.map((stat) => (
            <div className="flex flex-col justify-between p-6" key={stat.label}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-secondary">{stat.label}</span>
                <span className="material-symbols-outlined text-[18px] text-muted">
                  {stat.icon}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[30px] font-semibold leading-none tracking-tight text-ink">
                  {stat.value}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted">{stat.caption}</p>
              <div className="mt-4 flex items-center border-t border-surface-muted pt-3 text-[12px]">
                <span className={`flex items-center gap-1 ${stat.tone}`}>
                  <span className="material-symbols-outlined text-[14px]">{stat.footerIcon}</span>
                  {stat.footer}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <section
            aria-labelledby="top-products-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink" id="top-products-heading">
                  Produk terlaris hari ini
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">Berdasarkan pendapatan sebelum pajak</p>
              </div>
              {canReport ? (
                <Link
                  className="text-[12px] font-semibold text-forest hover:text-forest-hover"
                  href="/reports?type=products"
                >
                  Lihat laporan
                </Link>
              ) : null}
            </div>
            {summary.topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Belum ada penjualan tercatat hari ini.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                      <th className="py-2 pr-4 font-medium">Produk</th>
                      <th className="py-2 pr-4 font-medium">SKU</th>
                      <th className="py-2 pr-4 text-right font-medium">Terjual</th>
                      <th className="py-2 text-right font-medium">Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.topProducts.map((product) => (
                      <tr key={`${product.productId ?? product.sku}`}>
                        <td className="py-2.5 pr-4 font-medium text-ink">{product.name}</td>
                        <td className="py-2.5 pr-4 text-muted">{product.sku}</td>
                        <td className="py-2.5 pr-4 text-right text-ink">
                          {formatNumber(product.quantity, 2)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-ink">
                          {formatMoney(product.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            aria-labelledby="recent-sales-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink" id="recent-sales-heading">
                  Transaksi terakhir
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">Aktivitas kasir di cabang ini</p>
              </div>
              <Link
                className="text-[12px] font-semibold text-forest hover:text-forest-hover"
                href="/sales"
              >
                Semua transaksi
              </Link>
            </div>
            {summary.recentSales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Belum ada transaksi.</p>
            ) : (
              <div className="mt-4 divide-y divide-line">
                {summary.recentSales.map((sale) => {
                  const status = STATUS_LABEL[sale.status] ?? {
                    label: sale.status,
                    className: "bg-moss text-ink",
                  };
                  return (
                    <Link
                      className="-mx-2 flex items-center justify-between gap-3 rounded px-2 py-3 hover:bg-paper"
                      href={`/sales/${sale.id}`}
                      key={sale.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {sale.receiptNumber}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {sale.customerName ?? "Pelanggan umum"} · {sale.cashierName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`hidden rounded-full px-2 py-0.5 text-[11px] sm:inline-flex ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span className="text-[13px] font-semibold text-ink">
                          {formatMoney(sale.grandTotal, currency)}
                        </span>
                        <span className="w-12 text-right text-[11px] text-muted">
                          {formatTime(sale.soldAt, session.organization.timezone)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <ActivityPanel rows={activityRows} timeZone={session.organization.timezone} />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          {canSell ? (
            <Link
              className="flex h-11 items-center justify-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
              href="/pos"
            >
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
              Transaksi baru
            </Link>
          ) : null}

          <section
            aria-labelledby="low-stock-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink" id="low-stock-heading">
                  Stok menipis
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">Produk di bawah minimum</p>
              </div>
              <Link
                className="text-[12px] font-semibold text-forest hover:text-forest-hover"
                href="/inventory?lowStock=1"
              >
                Kelola
              </Link>
            </div>
            {summary.lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Semua stok aman.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {summary.lowStock.map((item) => (
                  <div className="flex items-center justify-between gap-3" key={item.productId}>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{item.name}</p>
                      <p className="text-[11px] text-muted">{item.sku}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-bg px-2 py-0.5 text-[11px] font-semibold text-amber">
                      {formatNumber(item.quantity, 2)} / {formatNumber(item.minimumStock, 2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            aria-labelledby="payments-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <h2 className="text-xl font-semibold tracking-tight text-ink" id="payments-heading">
              Metode pembayaran
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">Komposisi pembayaran hari ini</p>
            {summary.paymentMethods.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Belum ada pembayaran.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {summary.paymentMethods.map((method) => (
                  <div className="flex items-center justify-between gap-3" key={method.method}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-moss text-[11px] font-semibold text-forest">
                        {method.count}
                      </span>
                      <span className="text-[13px] text-ink">
                        {METHOD_LABEL[method.method] ?? method.method}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-ink">
                      {formatMoney(method.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            aria-labelledby="shifts-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink" id="shifts-heading">
                  Shift berjalan
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">Kasir yang sedang bertugas</p>
              </div>
              <Link
                className="text-[12px] font-semibold text-forest hover:text-forest-hover"
                href="/shifts"
              >
                Detail
              </Link>
            </div>
            {summary.activeShifts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Tidak ada shift terbuka.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {summary.activeShifts.map((shift) => (
                  <div className="flex items-center justify-between gap-3" key={shift.id}>
                    <div>
                      <p className="text-[13px] font-medium text-ink">{shift.cashierName}</p>
                      <p className="text-[11px] text-muted">
                        Sejak {formatTime(shift.openedAt, session.organization.timezone)}
                      </p>
                    </div>
                    <span className="text-[12px] text-muted">
                      {formatMoney(shift.openingAmount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
