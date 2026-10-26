import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getCustomer } from "@/lib/customers/service";
import { formatDateTime } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { Badge, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const SALE_STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: "Selesai", tone: "success" },
  voided: { label: "Dibatalkan", tone: "danger" },
  refunded: { label: "Refund", tone: "warning" },
  partially_refunded: { label: "Refund sebagian", tone: "warning" },
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission(PERMISSIONS.customerView, "/customers");
  const { id } = await params;
  const customer = await getCustomer(session, id).catch(() => null);
  if (!customer) notFound();

  const currency = session.organization.currency;

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Pelanggan"
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={customer.status === "active" ? "success" : "neutral"}>
              {customer.status === "active" ? "Aktif" : "Arsip"}
            </Badge>
            <span>
              {customer.phone ?? "Tanpa telepon"} · {customer.email ?? "Tanpa email"}
            </span>
          </span>
        }
        actions={
          <Link
            className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
            href="/customers"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Transaksi</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatNumber(customer.transactionCount, 0)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Total belanja</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatMoney(customer.totalSpent, currency)}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Rata-rata / transaksi</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {formatMoney(
              customer.transactionCount > 0
                ? Math.round(customer.totalSpent / customer.transactionCount)
                : 0,
              currency,
            )}
          </p>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Sejak</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {formatDateTime(customer.createdAt, session.organization.timezone)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Riwayat transaksi</h2>
          </div>
          {customer.history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">
              Pelanggan ini belum memiliki transaksi.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {customer.history.map((sale) => {
                const status = SALE_STATUS[sale.status] ?? {
                  label: sale.status,
                  tone: "neutral",
                };
                return (
                  <li className="flex items-center justify-between gap-3 px-4 py-3" key={sale.id}>
                    <div>
                      <Link
                        className="text-[13px] font-semibold text-ink hover:text-forest"
                        href={`/sales/${sale.id}`}
                      >
                        {sale.receiptNumber}
                      </Link>
                      <p className="text-[11px] text-muted">
                        {formatDateTime(sale.soldAt, session.organization.timezone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-[13px] font-semibold text-ink">
                        {formatMoney(sale.grandTotal, currency)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">Informasi</h2>
          </div>
          <dl className="space-y-3 px-4 py-4 text-[12px]">
            <div>
              <dt className="text-muted">Telepon</dt>
              <dd className="font-medium text-ink">{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-ink">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Alamat</dt>
              <dd className="whitespace-pre-line font-medium text-ink">
                {customer.address ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Catatan</dt>
              <dd className="whitespace-pre-line font-medium text-ink">{customer.notes ?? "—"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
