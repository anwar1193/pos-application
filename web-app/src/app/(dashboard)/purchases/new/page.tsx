import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { listSuppliers } from "@/lib/customers/service";
import { PageHeader, Panel } from "@/components/ui";
import { PurchaseForm } from "./purchase-form";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.purchaseManage, "/purchases");
  const raw = await searchParams;
  const branchId = await resolveBranchId(session, str(raw.branch));
  const [branches, suppliers] = await Promise.all([
    listShellBranches(session),
    listSuppliers(session, { status: "active", pageSize: 200 }),
  ]);
  const branch = branches.find((item) => item.id === branchId);

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Pembelian"
        title="Purchase order baru"
        description={`Pesan barang dari supplier untuk ${branch?.name ?? "cabang"}.`}
        actions={
          <Link
            className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
            href="/purchases"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali
          </Link>
        }
      />

      {suppliers.items.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Belum ada supplier aktif</p>
            <p className="mt-1 text-[13px] text-muted">
              Tambahkan supplier terlebih dahulu sebelum membuat purchase order.
            </p>
            <Link
              className="mt-4 inline-flex h-9 items-center rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover"
              href="/suppliers"
            >
              Kelola supplier
            </Link>
          </div>
        </Panel>
      ) : (
        <PurchaseForm
          branchId={branchId}
          branchName={branch?.name ?? "Cabang"}
          suppliers={suppliers.items.map((supplier) => ({
            id: supplier.id,
            name: supplier.name,
          }))}
          currency={session.organization.currency}
        />
      )}
    </div>
  );
}
