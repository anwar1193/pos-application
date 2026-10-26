import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listSuppliers } from "@/lib/customers/service";
import { formatNumber } from "@/lib/format/money";
import { contactListQuerySchema } from "@/lib/validation/pos-schemas";
import { EmptyState, PageHeader, Pagination, Panel } from "@/components/ui";
import { ContactManager } from "@/components/contact-manager";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.supplierView, "/suppliers");
  const raw = await searchParams;
  const parsed = contactListQuerySchema.safeParse({
    q: str(raw.q),
    status: str(raw.status),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "25",
  });
  const query = parsed.success ? parsed.data : {};
  const result = await listSuppliers(session, query);
  const canManage = session.permissions.includes(PERMISSIONS.supplierManage);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Relasi"
        title="Supplier"
        description={`${formatNumber(result.total, 0)} supplier terdaftar.`}
        actions={<ContactManager canManage={canManage} kind="supplier" mode="create" />}
      />

      <Panel>
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end"
          method="get"
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari supplier
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
            href="/suppliers"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada supplier yang cocok dengan pencarian."
            icon="local_shipping"
            title="Tidak ada supplier"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Kontak</th>
                  <th className="px-4 py-3 font-semibold">Alamat</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((supplier) => (
                  <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={supplier.id}>
                    <td className="px-4 py-3 text-[13px] font-semibold text-ink">{supplier.name}</td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {supplier.phone ?? "—"}
                      {supplier.email ? (
                        <p className="text-[11px] text-muted">{supplier.email}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {supplier.address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          supplier.status === "active"
                            ? "bg-success-bg text-success"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {supplier.status === "active" ? "Aktif" : "Arsip"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ContactManager
                        canManage={canManage}
                        kind="supplier"
                        mode="edit"
                        target={{
                          id: supplier.id,
                          name: supplier.name,
                          phone: supplier.phone,
                          email: supplier.email,
                          address: supplier.address,
                          notes: supplier.notes,
                          status: supplier.status,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/suppliers"
          page={result.page}
          params={{ q: query.q, status: query.status }}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
