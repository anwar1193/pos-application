import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches } from "@/lib/branches/service";
import { formatDateTime, formatRelative } from "@/lib/format";
import { listAuditLogs } from "@/lib/settings/service";
import { listUsers } from "@/lib/users/service";
import { auditListQuerySchema } from "@/lib/validation/pos-schemas";
import { EmptyState, PageHeader, Pagination, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pretty(value: string | null): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function actionTone(action: string): string {
  if (action.startsWith("settings.")) return "warning";
  if (action.startsWith("sale.") || action.startsWith("refund.")) return "info";
  if (action.startsWith("inventory.") || action.startsWith("purchase.")) return "success";
  if (action.startsWith("auth.") || action.startsWith("user.")) return "neutral";
  return "neutral";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.auditView, "/audit");
  const raw = await searchParams;
  const parsed = auditListQuerySchema.safeParse({
    q: str(raw.q),
    action: str(raw.action),
    actor: str(raw.actor),
    branch: str(raw.branch),
    from: str(raw.from),
    to: str(raw.to),
    page: str(raw.page) ?? "1",
    pageSize: str(raw.pageSize) ?? "25",
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 25 };
  const [result, actors, branches] = await Promise.all([
    listAuditLogs(session, query),
    listUsers(session, { pageSize: 100 }).catch(() => ({ items: [] })),
    listShellBranches(session),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filterParams = {
    q: query.q,
    action: query.action,
    actor: query.actor,
    branch: query.branch,
    from: query.from,
    to: query.to,
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Keamanan"
        title="Audit Log"
        description="Catatan permanen setiap tindakan penting. Entri tidak dapat diubah atau dihapus."
      />

      <Panel className="mb-5">
        <form
          className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari
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
                placeholder="Aksi, entitas, atau detail"
                type="search"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="action">
              Aksi
            </label>
            <input
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none"
              defaultValue={query.action}
              id="action"
              name="action"
              placeholder="mis. sale.create"
              type="search"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="actor">
              Aktor
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
              defaultValue={query.actor ?? ""}
              id="actor"
              name="actor"
            >
              <option value="">Semua pengguna</option>
              {actors.items.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
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
                className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink"
                defaultValue={query.branch ?? ""}
                id="branch"
                name="branch"
              >
                <option value="">Semua cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
            href="/audit"
          >
            Reset
          </Link>
        </form>
      </Panel>

      <Panel>
        {result.items.length === 0 ? (
          <EmptyState
            description="Tidak ada entri audit yang cocok dengan filter ini."
            icon="history"
            title="Audit log kosong"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                  <th className="px-4 py-3 font-semibold">Entitas</th>
                  <th className="px-4 py-3 font-semibold">Aktor</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((entry) => {
                  const branchName =
                    branches.find((branch) => branch.id === entry.branchId)?.name ?? "—";
                  const details = [
                    entry.beforeData ? `Sebelum:\n${pretty(entry.beforeData)}` : null,
                    entry.afterData ? `Sesudah:\n${pretty(entry.afterData)}` : null,
                    entry.metadata ? `Metadata:\n${pretty(entry.metadata)}` : null,
                  ].filter(Boolean) as string[];
                  return (
                    <tr
                      className="border-b border-line align-top last:border-0"
                      key={entry.id}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-[12px] font-medium text-ink">
                          {formatDateTime(entry.createdAt, session.organization.timezone)}
                        </p>
                        <p className="text-[11px] text-muted">
                          {formatRelative(entry.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            actionTone(entry.action) === "warning"
                              ? "bg-amber-bg text-amber"
                              : actionTone(entry.action) === "info"
                                ? "bg-moss text-forest"
                                : actionTone(entry.action) === "success"
                                  ? "bg-success-bg text-success"
                                  : "bg-surface-muted text-secondary"
                          }`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        <p>{entry.entityType}</p>
                        <p className="text-[11px] text-muted">{entry.entityId ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">
                        {entry.actorName ?? "Sistem"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-secondary">{branchName}</td>
                      <td className="px-4 py-3">
                        {details.length === 0 ? (
                          <span className="text-[12px] text-muted">—</span>
                        ) : (
                          <details className="max-w-[420px]">
                            <summary className="cursor-pointer text-[12px] font-semibold text-forest">
                              Lihat detail
                            </summary>
                            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-muted p-2 text-[11px] text-secondary">
                              {details.join("\n\n")}
                            </pre>
                          </details>
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
          basePath="/audit"
          page={result.page}
          params={{
            ...filterParams,
            pageSize: result.pageSize === 25 ? undefined : result.pageSize,
          }}
          totalPages={totalPages}
        />
      </Panel>
    </div>
  );
}
