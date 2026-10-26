import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { getSale } from "@/lib/sales/service";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { SaleActions } from "./sale-actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: "Selesai", tone: "success" },
  voided: { label: "Dibatalkan", tone: "danger" },
  refunded: { label: "Refund penuh", tone: "warning" },
  partially_refunded: { label: "Refund sebagian", tone: "warning" },
};

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission(PERMISSIONS.saleView, "/sales");
  const { id } = await params;
  const sale = await getSale(session, id).catch(() => null);
  if (!sale) notFound();

  const currency = session.organization.currency;
  const status = STATUS[sale.status] ?? { label: sale.status, tone: "neutral" };
  const canVoid = session.permissions.includes(PERMISSIONS.saleVoid);
  const canRefund = session.permissions.includes(PERMISSIONS.saleRefund);

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Detail Transaksi"
        title={sale.receiptNumber}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>
              {formatDateTime(sale.soldAt, session.organization.timezone)} · {sale.branchName}
            </span>
          </span>
        }
        actions={
          <SaleActions
            canRefund={canRefund}
            canVoid={canVoid}
            currency={currency}
            printData={{
              receiptNumber: sale.receiptNumber,
              soldAt: sale.soldAt.toISOString(),
              branchName: sale.branchName,
              cashierName: sale.cashierName,
              customerName: sale.customerName,
              customerPhone: sale.customerPhone,
              notes: sale.notes,
              items: sale.items.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
              })),
              subtotal: sale.subtotal,
              discountTotal: sale.discountTotal,
              taxTotal: sale.taxTotal,
              grandTotal: sale.grandTotal,
              paidTotal: sale.paidTotal,
              changeTotal: sale.changeTotal,
            }}
            refundItems={sale.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              quantity: item.quantity,
              refundedQuantity: Number(item.refundedQuantity),
              lineTotal: item.lineTotal,
              unitPrice: item.unitPrice,
            }))}
            saleId={sale.id}
            status={sale.status}
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold text-ink">Item</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">Produk</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Harga</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Diskon</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Pajak</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr className="border-b border-line last:border-0" key={item.id}>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-ink">{item.productName}</p>
                        <p className="text-[11px] text-muted">
                          {item.sku}
                          {Number(item.refundedQuantity) > 0
                            ? ` · direfund ${formatNumber(Number(item.refundedQuantity))}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatMoney(item.unitPrice, currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {item.discountAmount > 0
                          ? `-${formatMoney(item.discountAmount, currency)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {item.taxAmount > 0 ? formatMoney(item.taxAmount, currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                        {formatMoney(item.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-line px-4 py-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-ink">{formatMoney(sale.subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Diskon</dt>
                <dd className="text-ink">-{formatMoney(sale.discountTotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Pajak</dt>
                <dd className="text-ink">{formatMoney(sale.taxTotal, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-bold">
                <dt className="text-ink">Total</dt>
                <dd className="text-forest">{formatMoney(sale.grandTotal, currency)}</dd>
              </div>
              {sale.refundedTotal > 0 ? (
                <div className="flex justify-between text-amber">
                  <dt>Total refund</dt>
                  <dd>-{formatMoney(sale.refundedTotal, currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted">Dibayar</dt>
                <dd className="text-ink">{formatMoney(sale.paidTotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Kembalian</dt>
                <dd className="text-ink">{formatMoney(sale.changeTotal, currency)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold text-ink">Pembayaran</h2>
            </div>
            {sale.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted">Belum ada pembayaran.</p>
            ) : (
              <ul className="divide-y divide-line">
                {sale.payments.map((payment) => (
                  <li className="flex items-center justify-between gap-3 px-4 py-3" key={payment.id}>
                    <div>
                      <p className="text-[13px] font-semibold capitalize text-ink">
                        {payment.method}
                      </p>
                      <p className="text-[11px] text-muted">
                        {payment.status}
                        {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-ink">
                      {formatMoney(payment.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {sale.refunds.length > 0 ? (
            <Panel>
              <div className="border-b border-line px-4 py-3">
                <h2 className="text-[15px] font-semibold text-ink">Riwayat refund</h2>
              </div>
              <ul className="divide-y divide-line">
                {sale.refunds.map((refund) => (
                  <li className="flex items-start justify-between gap-3 px-4 py-3" key={refund.id}>
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {formatMoney(refund.amount, currency)}
                      </p>
                      <p className="text-[12px] text-muted">{refund.reason}</p>
                      <p className="text-[11px] text-muted">
                        {refund.approvedByName ?? "Sistem"} ·{" "}
                        {formatDateTime(refund.createdAt, session.organization.timezone)}
                      </p>
                    </div>
                    <Badge tone={refund.status === "approved" ? "warning" : "neutral"}>
                      {refund.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold text-ink">Informasi</h2>
            </div>
            <dl className="space-y-3 px-4 py-4 text-[12px]">
              <div>
                <dt className="text-muted">Cabang</dt>
                <dd className="font-medium text-ink">{sale.branchName}</dd>
                {sale.branchAddress ? (
                  <dd className="mt-0.5 text-[11px] text-muted">{sale.branchAddress}</dd>
                ) : null}
              </div>
              <div>
                <dt className="text-muted">Kasir</dt>
                <dd className="font-medium text-ink">{sale.cashierName}</dd>
              </div>
              <div>
                <dt className="text-muted">Pelanggan</dt>
                <dd className="font-medium text-ink">{sale.customerName ?? "Pelanggan umum"}</dd>
                {sale.customerPhone ? (
                  <dd className="text-[11px] text-muted">{sale.customerPhone}</dd>
                ) : null}
              </div>
              <div>
                <dt className="text-muted">Waktu</dt>
                <dd className="font-medium text-ink">
                  {formatDateTime(sale.soldAt, session.organization.timezone)}
                </dd>
              </div>
              {sale.notes ? (
                <div>
                  <dt className="text-muted">Catatan</dt>
                  <dd className="whitespace-pre-line text-ink">{sale.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Link
            className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white text-[13px] font-semibold text-ink hover:bg-paper"
            href="/sales"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali ke daftar
          </Link>
        </div>
      </div>
    </div>
  );
}
