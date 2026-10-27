import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/format/money";
import { listCashiers } from "@/lib/sales/service";
import {
  getCurrentShift,
  listShiftApprovers,
  listShifts,
  SHIFT_DIFFERENCE_THRESHOLD,
} from "@/lib/shifts/service";
import { Badge, EmptyState, PageHeader, Pagination, Panel } from "@/components/ui";
import { ShiftPanel } from "./shift-panel";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Terbuka", tone: "success" },
  closed: { label: "Ditutup", tone: "neutral" },
};

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.shiftView, "/shifts");
  const raw = await searchParams;
  const branchId = await resolveBranchId(session, str(raw.branch));
  const page = Math.max(1, Number(str(raw.page) ?? 1) || 1);
  const [current, result, branches, cashiers] = await Promise.all([
    getCurrentShift(session, branchId),
    listShifts(session, {
      branch: branchId,
      status: str(raw.status),
      cashier: str(raw.cashier),
      period: str(raw.period) ?? "30d",
      page,
      pageSize: 20,
    }),
    listShellBranches(session),
    listCashiers(session),
  ]);
  const canManage = session.permissions.includes(PERMISSIONS.shiftManage);
  const approvers = canManage ? await listShiftApprovers(session) : [];
  const currency = session.organization.currency;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const branch = branches.find((item) => item.id === branchId);

  const currentForPanel = current
    ? {
        id: current.id,
        openedAt: current.openedAt.toISOString(),
        branchName: current.branchName ?? branch?.name ?? "Cabang",
        cashierName: current.cashierName,
        status: current.status,
        openingAmount: current.openingAmount,
        expectedAmount: current.expectedAmount,
        actualAmount: current.actualAmount,
        difference: current.difference,
        cashIn: current.cashIn,
        cashOut: current.cashOut,
        transactionCount: current.transactionCount,
        grossTotal: current.grossTotal,
      }
    : null;

  return (
    <div className="mx-auto max-w-[1300px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Kas & Rekonsiliasi"
        title="Shift Kasir"
        description={`Riwayat shift ${branch?.name ?? "cabang"} dan rekonsiliasi kas.`}
        actions={
          <Link
            className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
            href="/pos"
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            Layar kasir
          </Link>
        }
      />

      <div className="mb-5">
        <ShiftPanel
          approvers={approvers}
          branchId={branchId}
          canManage={canManage}
          currency={currency}
          current={currentForPanel}
          threshold={SHIFT_DIFFERENCE_THRESHOLD}
        />
      </div>

      <Panel>
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="period">
              Periode
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={str(raw.period) ?? "30d"}
              id="period"
              name="period"
            >
              <option value="today">Hari ini</option>
              <option value="yesterday">Kemarin</option>
              <option value="7d">7 hari terakhir</option>
              <option value="30d">30 hari terakhir</option>
              <option value="this_month">Bulan ini</option>
              <option value="last_month">Bulan lalu</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="status">
              Status
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={str(raw.status) ?? ""}
              id="status"
              name="status"
            >
              <option value="">Semua status</option>
              <option value="open">Terbuka</option>
              <option value="closed">Ditutup</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="cashier">
              Kasir
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none"
              defaultValue={str(raw.cashier) ?? ""}
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
            href="/shifts"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada shift pada periode ini."
            icon="schedule"
            title="Tidak ada shift"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Dibuka</th>
                  <th className="px-4 py-3 font-semibold">Kasir</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 text-right font-semibold">Kas awal</th>
                  <th className="px-4 py-3 text-right font-semibold">Seharusnya</th>
                  <th className="px-4 py-3 text-right font-semibold">Aktual</th>
                  <th className="px-4 py-3 text-right font-semibold">Selisih</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((shift) => {
                  const status = STATUS[shift.status] ?? {
                    label: shift.status,
                    tone: "neutral",
                  };
                  return (
                    <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={shift.id}>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {formatDateTime(shift.openedAt, session.organization.timezone)}
                        {shift.closedAt ? (
                          <p className="text-[11px] text-muted">
                            tutup {formatDateTime(shift.closedAt, session.organization.timezone)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-ink">
                        {shift.cashierName}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{shift.branchName}</td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatMoney(shift.openingAmount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {shift.expectedAmount === null
                          ? "—"
                          : formatMoney(shift.expectedAmount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {shift.actualAmount === null ? "—" : formatMoney(shift.actualAmount, currency)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-[12px] font-semibold ${
                          shift.difference === null
                            ? "text-muted"
                            : shift.difference === 0
                              ? "text-success"
                              : "text-brick"
                        }`}
                      >
                        {shift.difference === null ? "—" : formatMoney(shift.difference, currency)}
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
          basePath="/shifts"
          page={result.page}
          params={{
            period: str(raw.period) ?? "30d",
            status: str(raw.status),
            cashier: str(raw.cashier),
            branch: branchId,
          }}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
