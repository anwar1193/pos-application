import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches } from "@/lib/branches/service";
import { listCategories } from "@/lib/catalog/service";
import { formatDateTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { REPORT_TYPES, getReport } from "@/lib/reports/service";
import { listCashiers } from "@/lib/sales/service";
import { reportQuerySchema } from "@/lib/validation/pos-schemas";
import { EmptyState, PageHeader, Pagination, Panel, SummaryTile } from "@/components/ui";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const PERIODS = [
  { value: "today", label: "Hari ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "this_month", label: "Bulan ini" },
  { value: "last_month", label: "Bulan lalu" },
  { value: "custom", label: "Rentang khusus" },
];

const CASHIER_REPORTS = new Set(["sales", "products", "margin", "payments", "refunds"]);
const CATEGORY_REPORTS = new Set(["sales", "products", "margin", "payments", "refunds"]);
const PERIOD_REPORTS = new Set([
  "sales",
  "products",
  "margin",
  "payments",
  "movements",
  "purchases",
  "refunds",
  "shifts",
]);

const MONEY_KEYS = new Set([
  "amount",
  "gross",
  "discount",
  "tax",
  "refunds",
  "net",
  "revenue",
  "cost",
  "margin",
  "total",
  "openingAmount",
  "expectedAmount",
  "actualAmount",
  "difference",
  "costPrice",
  "sellingPrice",
]);

const NUMBER_KEYS = new Set([
  "transactions",
  "quantity",
  "balanceAfter",
  "minimumStock",
  "itemCount",
]);

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "Stok awal",
  purchase: "Pembelian",
  sale: "Penjualan",
  return_in: "Retur masuk",
  return_out: "Retur keluar",
  transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar",
  adjustment: "Penyesuaian",
  opname: "Opname",
  void: "Void",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  card: "Kartu",
  transfer: "Transfer",
  qr: "QRIS",
  manual: "Manual",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Lunas",
  pending: "Menunggu",
  failed: "Gagal",
  refunded: "Refund",
  partially_refunded: "Refund sebagian",
  open: "Terbuka",
  closed: "Ditutup",
  draft: "Draft",
  ordered: "Dipesan",
  partially_received: "Diterima sebagian",
  received: "Diterima",
  cancelled: "Dibatalkan",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
  voided: "Void",
};

const KIND_LABELS: Record<string, string> = {
  refund: "Refund",
  void: "Void",
};

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function humanize(value: string): string {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatRangeDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function renderValue(
  key: string,
  value: unknown,
  timezone: string,
  currency: string,
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted">—</span>;
  }
  if (value instanceof Date) {
    return formatDateTime(value, timezone);
  }
  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }
  if (typeof value === "number") {
    if (MONEY_KEYS.has(key)) return formatMoney(value, currency);
    if (NUMBER_KEYS.has(key)) return formatNumber(value);
    return formatNumber(value);
  }
  const text = String(value);
  if (key === "date") return formatRangeDate(text);
  if (key === "type") return MOVEMENT_LABELS[text] ?? humanize(text);
  if (key === "method") return METHOD_LABELS[text] ?? humanize(text);
  if (key === "status") return STATUS_LABELS[text] ?? humanize(text);
  if (key === "kind") return KIND_LABELS[text] ?? humanize(text);
  return text;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.reportView, "/reports");
  const raw = await searchParams;
  const parsed = reportQuerySchema.safeParse({
    type: str(raw.type) ?? "sales",
    branch: str(raw.branch),
    cashier: str(raw.cashier),
    category: str(raw.category),
    period: str(raw.period) ?? "30d",
    from: str(raw.from),
    to: str(raw.to),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "50",
  });
  const query = parsed.success
    ? parsed.data
    : { type: "sales" as const, period: "30d" as const, page: 1, pageSize: 50 };
  const type = query.type ?? "sales";
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const currency = session.organization.currency;
  const timezone = session.organization.timezone;

  const canListCashiers = session.permissions.includes(PERMISSIONS.saleView);
  const [branches, categories, cashiers] = await Promise.all([
    listShellBranches(session),
    listCategories(session, { status: "active" }).catch(() => []),
    canListCashiers ? listCashiers(session).catch(() => []) : Promise.resolve([]),
  ]);

  const report = await getReport(session, {
    type,
    branch: query.branch,
    cashier: query.cashier,
    category: query.category,
    period: query.period,
    from: query.from,
    to: query.to,
  }).catch((cause: unknown) => {
    return { error: cause instanceof Error ? cause.message : "Laporan gagal dimuat." };
  });

  const filterParams = {
    type,
    branch: query.branch,
    cashier: query.cashier,
    category: query.category,
    period: query.period,
    from: query.from,
    to: query.to,
  };
  const csvSearch = new URLSearchParams();
  for (const [key, value] of Object.entries(filterParams)) {
    if (value) csvSearch.set(key, value);
  }
  csvSearch.set("format", "csv");
  const csvHref = `/api/reports?${csvSearch.toString()}`;

  const showCashier = CASHIER_REPORTS.has(type) && cashiers.length > 0;
  const showCategory = CATEGORY_REPORTS.has(type) && categories.length > 0;
  const showPeriod = PERIOD_REPORTS.has(type);
  const branchName =
    branches.find((branch) => branch.id === query.branch)?.name ?? "Semua cabang";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <div data-print-hide>
        <PageHeader
          eyebrow="Laporan"
          title={report && "title" in report ? report.title : "Laporan"}
          description={
            report && "range" in report
              ? `${formatRangeDate(report.range.fromDate)} – ${formatRangeDate(
                  report.range.toDate,
                )} · ${branchName}`
              : "Pilih jenis laporan dan periode."
          }
          actions={
            <>
              <PrintButton />
              <Link
                className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
                href={csvHref}
                prefetch={false}
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Unduh CSV
              </Link>
            </>
          }
        />
      </div>

      <div data-print-hide>
        <Panel className="mb-5">
          <form
            className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
            method="get"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink" htmlFor="type">
                Jenis laporan
              </label>
              <select
                className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
                defaultValue={type}
                id="type"
                name="type"
              >
                {REPORT_TYPES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {showPeriod ? (
              <>
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
                  <label className="text-[12px] font-semibold text-ink" htmlFor="from">
                    Dari
                  </label>
                  <input
                    className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
                    defaultValue={query.from}
                    id="from"
                    name="from"
                    type="date"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-ink" htmlFor="to">
                    Sampai
                  </label>
                  <input
                    className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
                    defaultValue={query.to}
                    id="to"
                    name="to"
                    type="date"
                  />
                </div>
              </>
            ) : null}
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
            {showCashier ? (
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
            ) : null}
            {showCategory ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink" htmlFor="category">
                  Kategori
                </label>
                <select
                  className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
                  defaultValue={query.category ?? ""}
                  id="category"
                  name="category"
                >
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button
              className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
              type="submit"
            >
              Terapkan
            </button>
            <Link
              className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink"
              href="/reports"
            >
              Reset
            </Link>
          </form>
          {showPeriod ? (
            <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
              Isi tanggal awal dan akhir untuk memakai rentang khusus; periode di atas diabaikan
              jika kedua tanggal terisi.
            </p>
          ) : null}
        </Panel>
      </div>

      {"error" in report ? (
        <Panel>
          <EmptyState
            description={report.error}
            icon="error"
            title="Laporan tidak dapat dimuat"
          />
        </Panel>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {report.summary.map((item) => (
              <SummaryTile key={item.label} label={item.label} value={item.value} />
            ))}
          </div>

          <Panel>
            {report.rows.length === 0 ? (
              <EmptyState
                description="Tidak ada data pada filter ini. Coba ubah periode atau cabang."
                icon="summarize"
                title="Laporan kosong"
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-left"
                    style={{ minWidth: Math.max(720, report.columns.length * 130) }}
                  >
                    <thead>
                      <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                        {report.columns.map((column) => (
                          <th className="whitespace-nowrap px-4 py-3 font-semibold" key={column.key}>
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows
                        .slice((page - 1) * pageSize, page * pageSize)
                        .map((row, rowIndex) => (
                          <tr
                            className="border-b border-line last:border-0"
                            key={String(row.id ?? row.productId ?? row.receiptNumber ?? rowIndex)}
                          >
                            {report.columns.map((column) => {
                              const value = row[column.key];
                              const negative = typeof value === "number" && value < 0;
                              return (
                                <td
                                  className={`whitespace-nowrap px-4 py-2.5 text-[12px] ${
                                    negative ? "font-semibold text-brick" : "text-secondary"
                                  }`}
                                  key={column.key}
                                >
                                  {renderValue(column.key, value, timezone, currency)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div data-print-hide>
                  <Pagination
                    basePath="/reports"
                    page={page}
                    params={{ ...filterParams, pageSize: pageSize === 50 ? undefined : pageSize }}
                    totalPages={Math.max(1, Math.ceil(report.rows.length / pageSize))}
                  />
                </div>
                <p className="border-t border-line px-4 py-2 text-[11px] text-muted" data-print-hide>
                  Menampilkan {Math.min(report.rows.length, (page - 1) * pageSize + 1)}–
                  {Math.min(report.rows.length, page * pageSize)} dari {report.rows.length} baris.
                  Unduh CSV untuk data lengkap.
                </p>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
