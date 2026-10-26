import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatDateLong, formatDateTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { getPurchaseOrder } from "@/lib/purchasing/service";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { PurchaseActions } from "./purchase-actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  ordered: { label: "Dipesan", tone: "info" },
  partially_received: { label: "Diterima sebagian", tone: "warning" },
  received: { label: "Diterima", tone: "success" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
};

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission(PERMISSIONS.purchaseView, "/purchases");
  const { id } = await params;
  const order = await getPurchaseOrder(session, id).catch(() => null);
  if (!order) notFound();

  const currency = session.organization.currency;
  const status = STATUS[order.status] ?? { label: order.status, tone: "neutral" };
  const canManage = session.permissions.includes(PERMISSIONS.purchaseManage);
  const canReceive = session.permissions.includes(PERMISSIONS.purchaseReceive);
  const orderedTotal = order.items.reduce(
    (sum, item) => sum + Math.round(item.unitCost) * item.quantity,
    0,
  );
  const receivedTotal = order.items.reduce(
    (sum, item) => sum + Math.round(item.unitCost) * item.receivedQuantity,
    0,
  );

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Purchase order"
        title={order.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>
              {order.supplierName} · {order.branchName} ·{" "}
              {formatDateLong(order.createdAt, session.organization.timezone)}
            </span>
          </span>
        }
        actions={
          <>
            <PurchaseActions
              canManage={canManage}
              canReceive={canReceive}
              currency={currency}
              id={order.id}
              items={order.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                receivedQuantity: item.receivedQuantity,
              }))}
              status={order.status}
            />
            <Link
              className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
              href="/purchases"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Kembali
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Total PO</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatMoney(orderedTotal, currency)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Nilai diterima</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatMoney(receivedTotal, currency)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Dipesan pada</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {order.orderedAt
              ? formatDateTime(order.orderedAt, session.organization.timezone)
              : "Belum dipesan"}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Dibuat oleh</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-ink">
            {order.createdByName ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Item</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Produk</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Dipesan</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Diterima</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Harga beli</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr className="border-b border-line last:border-0" key={item.id}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-ink">{item.productName}</p>
                      <p className="text-[11px] text-muted">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatNumber(item.quantity)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-[12px] font-semibold ${
                        item.receivedQuantity >= item.quantity ? "text-success" : "text-amber"
                      }`}
                    >
                      {formatNumber(item.receivedQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatMoney(item.unitCost, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                      {formatMoney(Math.round(item.unitCost) * item.quantity, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1.5 border-t border-line px-4 py-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-ink">{formatMoney(order.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-bold">
              <dt className="text-ink">Total</dt>
              <dd className="text-forest">{formatMoney(order.total, currency)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel>
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Supplier</h2>
          </div>
          <dl className="space-y-3 px-4 py-4 text-[12px]">
            <div>
              <dt className="text-muted">Nama</dt>
              <dd className="font-medium text-ink">{order.supplierName}</dd>
            </div>
            <div>
              <dt className="text-muted">Telepon</dt>
              <dd className="font-medium text-ink">{order.supplierPhone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-ink">{order.supplierEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Catatan</dt>
              <dd className="whitespace-pre-line font-medium text-ink">{order.notes ?? "—"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
