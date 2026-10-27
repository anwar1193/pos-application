import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCategories, listProducts, listUnits } from "@/lib/catalog/service";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { formatNumber } from "@/lib/format/money";
import { productListQuerySchema } from "@/lib/validation/pos-schemas";
import { PageHeader, Pagination, Panel } from "@/components/ui";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.catalogView, "/catalog");
  const raw = await searchParams;
  const parsed = productListQuerySchema.safeParse({
    q: str(raw.q),
    category: str(raw.category),
    status: str(raw.status),
    lowStock: str(raw.lowStock),
    branch: str(raw.branch),
    sort: str(raw.sort),
    order: str(raw.order),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "20",
  });
  const query = parsed.success ? parsed.data : {};
  const branchId = await resolveBranchId(session, query.branch);
  const [result, categories, units, branches] = await Promise.all([
    listProducts(session, { ...query, branch: branchId }),
    listCategories(session, { status: "all" }),
    listUnits(session),
    listShellBranches(session),
  ]);
  const canManage = session.permissions.includes(PERMISSIONS.catalogManage);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currency = session.organization.currency;
  const branch = branches.find((item) => item.id === branchId);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Katalog"
        title="Produk"
        description={`${formatNumber(result.total, 0)} produk · ${branch?.name ?? "cabang"}`}
        actions={
          <>
            <Link
              className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
              href={`/api/products/export?branch=${encodeURIComponent(branchId)}`}
              prefetch={false}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Ekspor CSV
            </Link>
            <Link
              className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
              href="/pos"
            >
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
              Kasir
            </Link>
          </>
        }
      />

      <Panel className="mb-5">
        <form
          className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari produk
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted">
                search
              </span>
              <input
                className="h-10 w-full rounded-control border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
                defaultValue={query.q}
                id="q"
                name="q"
                placeholder="Nama, SKU, atau barcode"
                type="search"
              />
            </div>
          </div>
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
              <option value="">Aktif</option>
              <option value="all">Semua</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[12px] font-medium text-secondary">
            <input
              defaultChecked={query.lowStock === "true"}
              name="lowStock"
              type="checkbox"
              value="true"
            />
            Stok menipis
          </label>
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
            href="/catalog"
          >
            Reset
          </Link>
        </form>
      </Panel>

      <CatalogClient
        branchId={branchId}
        canManage={canManage}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          status: category.status,
        }))}
        currency={currency}
        products={result.items.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          description: product.description,
          imageUrl: product.imageUrl,
          categoryId: product.categoryId,
          categoryName: product.categoryName,
          unitId: product.unitId,
          unitName: product.unitName,
          unitSymbol: product.unitSymbol,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          promoPrice: product.promoPrice,
          taxRate: product.taxRate,
          trackStock: product.trackStock,
          minimumStock: product.minimumStock,
          status: product.status,
          stock: product.stock,
        }))}
        units={units.map((unit) => ({ id: unit.id, name: unit.name, symbol: unit.symbol }))}
      />

      <Pagination
        basePath="/catalog"
        page={result.page}
        params={{
          q: query.q,
          category: query.category,
          status: query.status,
          lowStock: query.lowStock,
          branch: branchId,
        }}
        totalPages={totalPages}
      />
    </div>
  );
}
