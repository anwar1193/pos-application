import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches } from "@/lib/branches/service";
import { formatDateTime } from "@/lib/format";
import { formatNumber } from "@/lib/format/money";
import { getOpname } from "@/lib/inventory/service";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { OpnameComplete } from "./opname-complete";

export const dynamic = "force-dynamic";

export default async function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission(PERMISSIONS.inventoryView, "/inventory");
  const { id } = await params;
  const opname = await getOpname(session, id).catch(() => null);
  if (!opname) notFound();

  const branches = await listShellBranches(session);
  const branchName = branches.find((branch) => branch.id === opname.branchId)?.name ?? "Cabang";
  const canComplete =
    opname.status === "draft" && session.permissions.includes(PERMISSIONS.inventoryOpname);
  const differenceTotal = opname.items.reduce(
    (sum, item) => sum + Math.abs(Number(item.difference)),
    0,
  );

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Stock opname"
        title={branchName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={opname.status === "draft" ? "warning" : "success"}>
              {opname.status === "draft" ? "Draft" : "Selesai"}
            </Badge>
            <span>
              Dimulai {formatDateTime(opname.startedAt, session.organization.timezone)}
              {opname.completedAt
                ? ` · selesai ${formatDateTime(opname.completedAt, session.organization.timezone)}`
                : ""}
            </span>
          </span>
        }
        actions={
          <>
            {canComplete ? <OpnameComplete id={opname.id} /> : null}
            <Link
              className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
              href="/inventory?tab=opname"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Kembali
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Item dihitung</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatNumber(opname.items.length, 0)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Produk berbeda</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatNumber(opname.items.filter((item) => Number(item.difference) !== 0).length, 0)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Total selisih absolut</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">{formatNumber(differenceTotal)}</p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Status</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {opname.status === "draft" ? "Menunggu diselesaikan" : "Sudah diterapkan ke stok"}
          </p>
        </div>
      </div>

      {opname.notes ? (
        <div className="mb-4 rounded-panel border border-line bg-surface px-4 py-3 text-[13px] text-secondary">
          <span className="font-semibold text-ink">Catatan: </span>
          {opname.notes}
        </div>
      ) : null}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Produk</th>
                <th className="px-4 py-3 text-right font-semibold">Sistem</th>
                <th className="px-4 py-3 text-right font-semibold">Hitungan fisik</th>
                <th className="px-4 py-3 text-right font-semibold">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {opname.items.map((item) => {
                const difference = Number(item.difference);
                return (
                  <tr className="border-b border-line last:border-0" key={item.productId}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-ink">{item.productName}</p>
                      <p className="text-[11px] text-muted">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatNumber(Number(item.systemQuantity))}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatNumber(Number(item.countedQuantity))}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-[13px] font-semibold ${
                        difference === 0
                          ? "text-muted"
                          : difference > 0
                            ? "text-success"
                            : "text-brick"
                      }`}
                    >
                      {difference > 0 ? "+" : ""}
                      {formatNumber(difference)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
