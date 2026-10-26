import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { formatDateLong } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { listPurchaseOrders } from "@/lib/purchasing/service";
import { purchaseListQuerySchema } from "@/lib/validation/pos-schemas";
import { Badge, EmptyState, PageHeader, Pagination, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const PURCHASE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  ordered: { label: "Dipesan", tone: "info" },
  partially_received: { label: "Diterima sebagian", tone: "warning" },
  received: { label: "Diterima", tone: "success" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
};

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.purchaseView, "/purchases");
  const raw = await searchParams;
  const branchId = await resolveBranchId(session, str(raw.branch));
  const parsed = purchaseListQuerySchema.safeParse({
    branch: branchId,
    status: str(raw.status),
    q: str(raw.q),
    page: str(raw.page) ?? "1",
    pageSize: "25",
  });
  const query = parsed.success ? parsed.data : { branch: branchId, page: 1, pageSize: 25 };
  const [result, branches] = await Promise.all([
    listPurchaseOrders(session, query),
    listShellBranches(session),
  ]);
  const canManage = session.permissions.includes(PERMISSIONS.purchaseManage);
  const currency = session.organization.currency;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const branch = branches.find((item) => item.id === branchId);

  return (
    <div className="mx-auto max-w-[1300px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Pembelian"
        title="Purchase Order"
        description={`${formatNumber(result.total, 0)} purchase order · ${branch?.name ?? "cabang"}.`}
        actions={
          canManage ? (
            <Link
              className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
              href={`/purchases/new?branch=${encodeURIComponent(branchId)}`}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Purchase order
            </Link>
          ) : null
        }
      />

      <Panel>
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari
            </label>
            <input
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
              defaultValue={query.q}
              id="q"
              name="q"
              placeholder="Nomor PO atau supplier"
              type="search"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="status">
              Status
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
              defaultValue={query.status ?? ""}
              id="status"
              name="status"
            >
              <option value="">Semua status</option>
              {Object.entries(PURCHASE_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
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
                className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
                defaultValue={branchId}
                id="branch"
                name="branch"
              >
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
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
            href="/purchases"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada purchase order pada filter ini."
            icon="receipt_long"
            title="Tidak ada purchase order"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Nomor</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 text-right font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => {
                  const status = PURCHASE_STATUS[order.status] ?? {
                    label: order.status,
                    tone: "neutral",
                  };
                  return (
                    <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={order.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="text-[13px] font-semibold text-ink hover:text-forest"
                          href={`/purchases/${order.id}`}
                        >
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{order.supplierName}</td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{order.branchName}</td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatNumber(Number(order.itemCount), 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                        {formatMoney(order.total, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {formatDateLong(order.createdAt, session.organization.timezone)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/purchases"
          page={result.page}
          params={{ q: query.q, status: query.status, branch: branchId }}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
