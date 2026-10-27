import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { formatDateTime } from "@/lib/format";
import { formatNumber } from "@/lib/format/money";
import {
  listInventory,
  listLowStock,
  listMovements,
  listOpnames,
  listTransfers,
} from "@/lib/inventory/service";
import { inventoryQuerySchema, movementQuerySchema } from "@/lib/validation/pos-schemas";
import { Badge, EmptyState, PageHeader, Pagination, Panel, SummaryTile } from "@/components/ui";
import { InventoryActions } from "./inventory-actions";
import { TransferActions } from "./transfer-actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "stock", label: "Saldo stok", icon: "inventory_2" },
  { key: "movements", label: "Pergerakan", icon: "swap_vert" },
  { key: "opname", label: "Stock opname", icon: "fact_check" },
  { key: "transfers", label: "Transfer", icon: "local_shipping" },
] as const;

const MOVEMENT_LABELS: Record<string, { label: string; tone: string }> = {
  initial: { label: "Stok awal", tone: "info" },
  purchase: { label: "Pembelian", tone: "success" },
  sale: { label: "Penjualan", tone: "neutral" },
  return_in: { label: "Retur masuk", tone: "success" },
  return_out: { label: "Retur keluar", tone: "warning" },
  transfer_in: { label: "Transfer masuk", tone: "info" },
  transfer_out: { label: "Transfer keluar", tone: "warning" },
  adjustment: { label: "Penyesuaian", tone: "warning" },
  opname: { label: "Opname", tone: "info" },
  void: { label: "Void", tone: "danger" },
};

const OPNAME_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "warning" },
  completed: { label: "Selesai", tone: "success" },
};

const TRANSFER_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  requested: { label: "Diajukan", tone: "info" },
  approved: { label: "Disetujui", tone: "info" },
  in_transit: { label: "Dikirim", tone: "warning" },
  partially_received: { label: "Diterima sebagian", tone: "warning" },
  received: { label: "Diterima", tone: "success" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
};

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function tabHref(tab: string, branchId: string) {
  return `/inventory?tab=${tab}&branch=${encodeURIComponent(branchId)}`;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.inventoryView, "/inventory");
  const raw = await searchParams;
  const tab = (["stock", "movements", "opname", "transfers"] as const).includes(
    str(raw.tab) as "stock",
  )
    ? (str(raw.tab) as string)
    : "stock";
  const branchId = await resolveBranchId(session, str(raw.branch));
  const branches = await listShellBranches(session);
  const canAdjust = session.permissions.includes(PERMISSIONS.inventoryAdjust);
  const canOpname = session.permissions.includes(PERMISSIONS.inventoryOpname);
  const canTransfer = session.permissions.includes(PERMISSIONS.inventoryTransfer);
  const branch = branches.find((item) => item.id === branchId);
  const page = Math.max(1, Number(str(raw.page) ?? 1) || 1);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Persediaan"
        title="Stok & Gudang"
        description={`Saldo, pergerakan, opname, dan transfer stok ${branch?.name ?? "cabang"}.`}
        actions={
          <InventoryActions
            branchId={branchId}
            branches={branches.filter((item) => item.id !== branchId)}
            canAdjust={canAdjust}
            canOpname={canOpname}
            canTransfer={canTransfer}
          />
        }
      />

      <nav className="mb-5 flex flex-wrap gap-1 rounded-panel border border-line bg-surface p-1.5">
        {TABS.map((item) => (
          <Link
            className={`flex items-center gap-2 rounded-control px-3 py-2 text-[13px] font-semibold transition ${
              tab === item.key
                ? "bg-forest text-white"
                : "text-secondary hover:bg-surface-muted hover:text-ink"
            }`}
            href={tabHref(item.key, branchId)}
            key={item.key}
          >
            <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {branches.length > 1 ? (
        <form className="mb-4 flex items-end gap-2" method="get">
          <input name="tab" type="hidden" value={tab} />
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
          <button
            className="h-10 rounded-control border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-paper"
            type="submit"
          >
            Ganti cabang
          </button>
        </form>
      ) : null}

      {tab === "stock" ? (
        <StockTab session={session} branchId={branchId} page={page} raw={raw} canAdjust={canAdjust} />
      ) : null}
      {tab === "movements" ? (
        <MovementsTab session={session} branchId={branchId} page={page} raw={raw} />
      ) : null}
      {tab === "opname" ? (
        <OpnameTab session={session} branchId={branchId} page={page} canOpname={canOpname} />
      ) : null}
      {tab === "transfers" ? (
        <TransfersTab
          session={session}
          branchId={branchId}
          page={page}
          canTransfer={canTransfer}
        />
      ) : null}

      <div className="mt-4 text-[11px] text-muted">
        Semua pergerakan stok bersifat permanen dan diaudit. Koreksi dilakukan lewat penyesuaian
        atau opname, bukan dengan menghapus riwayat.
      </div>
    </div>
  );
}

type Session = Awaited<ReturnType<typeof requirePagePermission>>;

async function StockTab({
  session,
  branchId,
  page,
  raw,
  canAdjust,
}: {
  session: Session;
  branchId: string;
  page: number;
  raw: Record<string, string | string[] | undefined>;
  canAdjust: boolean;
}) {
  const parsed = inventoryQuerySchema.safeParse({
    branch: branchId,
    q: str(raw.q),
    lowStock: str(raw.lowStock),
    page: String(page),
    pageSize: "25",
  });
  const query = parsed.success ? parsed.data : { branch: branchId, page, pageSize: 25 };
  const [result, lowStock] = await Promise.all([
    listInventory(session, query),
    listLowStock(session, branchId, 100),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryTile
          caption="Produk dengan pelacakan stok aktif"
          icon="inventory_2"
          label="Produk terlacak"
          value={formatNumber(result.total, 0)}
        />
        <SummaryTile
          caption="Stok di bawah atau sama dengan minimum"
          icon="warning"
          label="Stok menipis"
          value={formatNumber(lowStock.length, 0)}
        />
        <SummaryTile
          caption="Total unit pada halaman ini"
          icon="summarize"
          label="Unit ditampilkan"
          value={formatNumber(
            result.items.reduce((sum, item) => sum + Number(item.quantity), 0),
            0,
          )}
        />
      </div>

      <Panel>
        <form className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end" method="get">
          <input name="tab" type="hidden" value="stock" />
          <input name="branch" type="hidden" value={branchId} />
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari produk
            </label>
            <input
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
              defaultValue={query.q}
              id="q"
              name="q"
              placeholder="Nama atau SKU"
              type="search"
            />
          </div>
          <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-white px-3 text-[12px] font-medium text-secondary">
            <input
              defaultChecked={query.lowStock === "true"}
              name="lowStock"
              type="checkbox"
              value="true"
            />
            Hanya stok menipis
          </label>
          <button
            className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
            type="submit"
          >
            Terapkan
          </button>
          <Link
            className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink"
            href={`/inventory?tab=stock&branch=${encodeURIComponent(branchId)}`}
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            description="Belum ada produk terlacak yang cocok dengan filter."
            icon="inventory_2"
            title="Tidak ada stok"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Satuan</th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                  <th className="px-4 py-3 text-right font-semibold">Minimum</th>
                  <th className="px-4 py-3 font-semibold">Diperbarui</th>
                  {canAdjust ? <th className="px-4 py-3 font-semibold">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => {
                  const low = Number(item.quantity) <= item.minimumStock;
                  return (
                    <tr className="border-b border-line last:border-0 hover:bg-paper/70" key={item.productId}>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-ink">{item.name}</p>
                        <p className="text-[11px] text-muted">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{item.unitName ?? "—"}</td>
                      <td
                        className={`px-4 py-3 text-right text-[13px] font-semibold ${
                          low ? "text-amber" : "text-ink"
                        }`}
                      >
                        {formatNumber(Number(item.quantity))}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-muted">
                        {formatNumber(item.minimumStock)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {item.updatedAt
                          ? formatDateTime(item.updatedAt, session.organization.timezone)
                          : "—"}
                      </td>
                      {canAdjust ? (
                        <td className="px-4 py-3">
                          <Link
                            className="rounded px-2 py-1 text-[11px] font-semibold text-forest hover:bg-moss"
                            href={`/inventory?tab=movements&branch=${encodeURIComponent(branchId)}&product=${item.productId}`}
                          >
                            Riwayat
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/inventory"
          page={result.page}
          params={{
            tab: "stock",
            branch: branchId,
            q: query.q,
            lowStock: query.lowStock,
          }}
          totalPages={totalPages}
        />
      </Panel>
    </>
  );
}

async function MovementsTab({
  session,
  branchId,
  page,
  raw,
}: {
  session: Session;
  branchId: string;
  page: number;
  raw: Record<string, string | string[] | undefined>;
}) {
  const parsed = movementQuerySchema.safeParse({
    branch: branchId,
    product: str(raw.product),
    type: str(raw.type),
    from: str(raw.from),
    to: str(raw.to),
    page: String(page),
    pageSize: "30",
  });
  const query = parsed.success ? parsed.data : { branch: branchId, page, pageSize: 30 };
  const result = await listMovements(session, query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currency = session.organization.currency;

  return (
    <Panel>
      <form className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end" method="get">
        <input name="tab" type="hidden" value="movements" />
        <input name="branch" type="hidden" value={branchId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="type">
            Jenis
          </label>
          <select
            className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
            defaultValue={query.type ?? ""}
            id="type"
            name="type"
          >
            <option value="">Semua jenis</option>
            {Object.entries(MOVEMENT_LABELS).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="from">
            Dari
          </label>
          <input
            className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
            defaultValue={query.from}
            id="from"
            name="from"
            type="date"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="to">
            Sampai
          </label>
          <input
            className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
            defaultValue={query.to}
            id="to"
            name="to"
            type="date"
          />
        </div>
        <button
          className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
          type="submit"
        >
          Terapkan
        </button>
        <Link
          className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink"
          href={`/inventory?tab=movements&branch=${encodeURIComponent(branchId)}`}
        >
          Reset
        </Link>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          description="Belum ada pergerakan stok pada filter ini."
          icon="swap_vert"
          title="Tidak ada pergerakan"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Waktu</th>
                <th className="px-4 py-3 font-semibold">Produk</th>
                <th className="px-4 py-3 font-semibold">Jenis</th>
                <th className="px-4 py-3 text-right font-semibold">Perubahan</th>
                <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                <th className="px-4 py-3 font-semibold">Alasan</th>
                <th className="px-4 py-3 font-semibold">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((movement) => {
                const meta = MOVEMENT_LABELS[movement.type] ?? {
                  label: movement.type,
                  tone: "neutral",
                };
                return (
                  <tr className="border-b border-line last:border-0" key={movement.id}>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {formatDateTime(movement.createdAt, session.organization.timezone)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-ink">{movement.productName}</p>
                      <p className="text-[11px] text-muted">
                        {movement.sku} · {movement.branchName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-[13px] font-semibold ${
                        Number(movement.quantity) < 0 ? "text-brick" : "text-success"
                      }`}
                    >
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {formatNumber(Number(movement.quantity))}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatNumber(Number(movement.balanceAfter))}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {movement.reason ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {movement.actorName ?? "Sistem"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
        Nilai dalam {currency}. Riwayat tidak dapat diubah atau dihapus.
      </p>
      <Pagination
        basePath="/inventory"
        page={result.page}
        params={{
          tab: "movements",
          branch: branchId,
          type: query.type,
          from: query.from,
          to: query.to,
          product: query.product,
        }}
        totalPages={totalPages}
      />
    </Panel>
  );
}

async function OpnameTab({
  session,
  branchId,
  page,
  canOpname,
}: {
  session: Session;
  branchId: string;
  page: number;
  canOpname: boolean;
}) {
  const result = await listOpnames(session, { branch: branchId, page, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold text-ink">Riwayat stock opname</h2>
        {canOpname ? (
          <span className="text-[11px] text-muted">
            Buat opname baru lewat tombol “Stock opname” di atas.
          </span>
        ) : null}
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          description="Belum ada opname untuk cabang ini."
          icon="fact_check"
          title="Tidak ada opname"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Dimulai</th>
                <th className="px-4 py-3 font-semibold">Cabang</th>
                <th className="px-4 py-3 font-semibold">Dibuat oleh</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Catatan</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((opname) => {
                const status = OPNAME_STATUS[opname.status] ?? {
                  label: opname.status,
                  tone: "neutral",
                };
                return (
                  <tr className="border-b border-line last:border-0" key={opname.id}>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {formatDateTime(opname.startedAt, session.organization.timezone)}
                      {opname.completedAt ? (
                        <p className="text-[11px] text-muted">
                          selesai {formatDateTime(opname.completedAt, session.organization.timezone)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">{opname.branchName}</td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {opname.createdByName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {opname.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="rounded px-2 py-1 text-[11px] font-semibold text-forest hover:bg-moss"
                        href={`/inventory/opname/${opname.id}`}
                      >
                        Lihat
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/inventory"
        page={result.page}
        params={{ tab: "opname", branch: branchId }}
        totalPages={totalPages}
      />
    </Panel>
  );
}

async function TransfersTab({
  session,
  branchId,
  page,
  canTransfer,
}: {
  session: Session;
  branchId: string;
  page: number;
  canTransfer: boolean;
}) {
  const result = await listTransfers(session, { branch: branchId, page, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold text-ink">Transfer stok</h2>
        {canTransfer ? (
          <span className="text-[11px] text-muted">
            Buat transfer baru lewat tombol “Transfer” di atas.
          </span>
        ) : null}
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          description="Belum ada transfer stok yang melibatkan cabang ini."
          icon="local_shipping"
          title="Tidak ada transfer"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Dibuat</th>
                <th className="px-4 py-3 font-semibold">Dari</th>
                <th className="px-4 py-3 font-semibold">Ke</th>
                <th className="px-4 py-3 text-right font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((transfer) => {
                const status = TRANSFER_STATUS[transfer.status] ?? {
                  label: transfer.status,
                  tone: "neutral",
                };
                return (
                  <tr className="border-b border-line last:border-0" key={transfer.id}>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {formatDateTime(transfer.createdAt, session.organization.timezone)}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-medium text-ink">
                      {transfer.fromBranchName}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {transfer.toBranchName}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-secondary">
                      {formatNumber(Number(transfer.itemCount), 0)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canTransfer ? (
                        <TransferActions
                          branchId={branchId}
                          fromBranchId={transfer.fromBranchId}
                          id={transfer.id}
                          status={transfer.status}
                          toBranchId={transfer.toBranchId}
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
        basePath="/inventory"
        page={result.page}
        params={{ tab: "transfers", branch: branchId }}
        totalPages={totalPages}
      />
    </Panel>
  );
}
