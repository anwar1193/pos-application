import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches } from "@/lib/branches/service";
import { formatDateTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { listCashiers, listSales } from "@/lib/sales/service";
import { saleListQuerySchema } from "@/lib/validation/pos-schemas";
import { Badge, EmptyState, PageHeader, Pagination, Panel, SummaryTile } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: "Selesai", tone: "success" },
  voided: { label: "Dibatalkan", tone: "danger" },
  refunded: { label: "Refund penuh", tone: "warning" },
  partially_refunded: { label: "Refund sebagian", tone: "warning" },
};

const PERIODS = [
  { value: "today", label: "Hari ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "this_month", label: "Bulan ini" },
  { value: "last_month", label: "Bulan lalu" },
];

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.saleView, "/sales");
  const raw = await searchParams;
  const parsed = saleListQuerySchema.safeParse({
    q: str(raw.q),
    status: str(raw.status),
    cashier: str(raw.cashier),
    branch: str(raw.branch),
    period: str(raw.period),
    from: str(raw.from),
    to: str(raw.to),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "20",
  });
  const query = parsed.success ? parsed.data : {};
  const [result, cashiers, branches] = await Promise.all([
    listSales(session, query),
    listCashiers(session),
    listShellBranches(session),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currency = session.organization.currency;
  const filterParams = {
    q: query.q,
    status: query.status,
    cashier: query.cashier,
    branch: query.branch,
    period: query.period,
    from: query.from,
    to: query.to,
    pageSize: query.pageSize === 20 ? undefined : query.pageSize,
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Penjualan"
        title="Transaksi"
        description={`${formatNumber(result.total, 0)} transaksi tercatat.`}
        actions={
          <Link
            className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
            href="/pos"
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            Transaksi baru
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile
          icon="payments"
          label="Penjualan kotor"
          value={formatMoney(result.summary.gross, currency)}
          caption="tidak termasuk transaksi void"
        />
        <SummaryTile
          icon="receipt_long"
          label="Transaksi"
          value={formatNumber(result.summary.transactions, 0)}
          caption="di semua cabang yang dapat diakses"
        />
        <SummaryTile
          icon="calculate"
          label="Rata-rata"
          value={formatMoney(
            result.summary.transactions > 0
              ? result.summary.gross / result.summary.transactions
              : 0,
            currency,
          )}
          caption="per transaksi"
        />
      </div>

      <Panel>
        <form className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end" method="get">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Nomor struk
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted">
                search
              </span>
              <input
                className="h-10 w-full rounded-control border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
                defaultValue={query.q}
                id="q"
                name="q"
                placeholder="Cari nomor struk"
                type="search"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="period">
              Periode
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={query.period ?? "30d"}
              id="period"
              name="period"
            >
              {PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="status">
              Status
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={query.status ?? ""}
              id="status"
              name="status"
            >
              <option value="">Semua status</option>
              <option value="completed">Selesai</option>
              <option value="partially_refunded">Refund sebagian</option>
              <option value="refunded">Refund penuh</option>
              <option value="voided">Dibatalkan</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="cashier">
              Kasir
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={query.cashier ?? ""}
              id="cashier"
              name="cashier"
            >
              <option value="">Semua kasir</option>
              {cashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.name}
                </option>
              ))}
            </select>
          </div>
          {branches.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink" htmlFor="branch">
                Cabang
              </label>
              <select
                className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
                defaultValue={query.branch ?? ""}
                id="branch"
                name="branch"
              >
                <option value="">Semua cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button
            className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black focus-ring"
            type="submit"
          >
            Terapkan
          </button>
          <Link
            className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink"
            href="/sales"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada transaksi yang cocok dengan filter ini. Coba ubah periode atau status."
            icon="receipt_long"
            title="Tidak ada transaksi"
            action={
              <Link
                className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
                href="/pos"
              >
                Mulai transaksi
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Struk</th>
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Kasir</th>
                  <th className="px-4 py-3 font-semibold">Pelanggan</th>
                  <th className="px-4 py-3 text-right font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((sale) => {
                  const status = STATUS[sale.status] ?? {
                    label: sale.status,
                    tone: "neutral",
                  };
                  return (
                    <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={sale.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="text-[13px] font-semibold text-forest hover:underline"
                          href={`/sales/${sale.id}`}
                        >
                          {sale.receiptNumber}
                        </Link>
                        {sale.refundedTotal > 0 ? (
                          <p className="text-[11px] text-amber">
                            refund {formatMoney(sale.refundedTotal, currency)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {formatDateTime(sale.soldAt, session.organization.timezone)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{sale.branchName}</td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{sale.cashierName}</td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {sale.customerName ?? "Umum"}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatNumber(Number(sale.itemCount), 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                        {formatMoney(sale.grandTotal, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/sales"
          page={result.page}
          params={filterParams}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
