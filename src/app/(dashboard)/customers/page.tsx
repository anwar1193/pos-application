import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCustomers } from "@/lib/customers/service";
import { formatDateLong } from "@/lib/format";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { contactListQuerySchema } from "@/lib/validation/pos-schemas";
import { EmptyState, PageHeader, Pagination, Panel } from "@/components/ui";
import { ContactManager } from "@/components/contact-manager";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(Number(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.customerView, "/customers");
  const raw = await searchParams;
  const parsed = contactListQuerySchema.safeParse({
    q: str(raw.q),
    status: str(raw.status),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "25",
  });
  const query = parsed.success ? parsed.data : {};
  const result = await listCustomers(session, query);
  const canManage = session.permissions.includes(PERMISSIONS.customerManage);
  const currency = session.organization.currency;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-[1300px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Relasi"
        title="Pelanggan"
        description={`${formatNumber(result.total, 0)} pelanggan terdaftar.`}
        actions={
          <ContactManager canManage={canManage} kind="customer" mode="create" />
        }
      />

      <Panel>
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end"
          method="get"
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari pelanggan
            </label>
            <input
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
              defaultValue={query.q}
              id="q"
              name="q"
              placeholder="Nama, telepon, atau email"
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
              <option value="">Aktif</option>
              <option value="all">Semua</option>
              <option value="archived">Arsip</option>
            </select>
          </div>
          <button
            className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
            type="submit"
          >
            Terapkan
          </button>
          <Link
            className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink"
            href="/customers"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada pelanggan yang cocok dengan pencarian."
            icon="group"
            title="Tidak ada pelanggan"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Pelanggan</th>
                  <th className="px-4 py-3 font-semibold">Kontak</th>
                  <th className="px-4 py-3 text-right font-semibold">Transaksi</th>
                  <th className="px-4 py-3 text-right font-semibold">Total belanja</th>
                  <th className="px-4 py-3 font-semibold">Terakhir belanja</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((customer) => {
                  const lastPurchase = toDate(customer.lastPurchaseAt);
                  return (
                    <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={customer.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="text-[13px] font-semibold text-ink hover:text-forest"
                          href={`/customers/${customer.id}`}
                        >
                          {customer.name}
                        </Link>
                        <p className="text-[11px] text-muted">
                          {customer.address ?? "Alamat belum diisi"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {customer.phone ?? "—"}
                        {customer.email ? (
                          <p className="text-[11px] text-muted">{customer.email}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-secondary">
                        {formatNumber(Number(customer.transactionCount), 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                        {formatMoney(Number(customer.totalSpent), currency)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {lastPurchase
                          ? formatDateLong(lastPurchase, session.organization.timezone)
                          : "Belum pernah"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            customer.status === "active"
                              ? "bg-success-bg text-success"
                              : "bg-surface-muted text-muted"
                          }`}
                        >
                          {customer.status === "active" ? "Aktif" : "Arsip"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage ? (
                          <ContactManager
                            canManage={canManage}
                            kind="customer"
                            mode="edit"
                            target={{
                              id: customer.id,
                              name: customer.name,
                              phone: customer.phone,
                              email: customer.email,
                              address: customer.address,
                              notes: customer.notes,
                              status: customer.status,
                            }}
                          />
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/customers"
          page={result.page}
          params={{ q: query.q, status: query.status }}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
