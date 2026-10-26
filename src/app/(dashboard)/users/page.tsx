import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatRelative, initials } from "@/lib/format";
import { USER_STATUS_LABELS, statusDot, statusStyle, type UserStatus } from "@/lib/users/labels";
import { listBranches, listRoles, listUsers } from "@/lib/users/service";
import { userListQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await requirePagePermission(PERMISSIONS.userView, "/users");
  const raw = await searchParams;
  const parsed = userListQuerySchema.safeParse({
    q: stringParam(raw.q),
    role: stringParam(raw.role),
    status: stringParam(raw.status),
    branch: stringParam(raw.branch),
    sort: stringParam(raw.sort),
    order: stringParam(raw.order),
    page: stringParam(raw.page),
    pageSize: stringParam(raw.pageSize) ?? "20",
  });
  const query = parsed.success ? parsed.data : {};
  const [result, roles, branches] = await Promise.all([
    listUsers(session, query),
    listRoles(session),
    listBranches(session),
  ]);
  const page = result.page;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const canInvite = session.permissions.includes(PERMISSIONS.userInvite);
  const sort = query.sort ?? "name";
  const order = query.order ?? "asc";

  function href(overrides: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    const values: Record<string, string | number | undefined> = {
      q: query.q,
      role: query.role,
      status: query.status,
      branch: query.branch,
      sort: query.sort,
      order: query.order,
      page: query.page,
      pageSize: query.pageSize === 20 ? undefined : query.pageSize,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/users?${qs}` : "/users";
  }

  function sortHref(column: "name" | "role" | "status" | "lastLogin") {
    return href({
      sort: column,
      order: sort === column && order === "asc" ? "desc" : "asc",
      page: 1,
    });
  }

  const sortIndicator = (column: string) =>
    sort === column ? (order === "asc" ? "arrow_upward" : "arrow_downward") : null;

  return (
    <div className="mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Tim &amp; Akses</p>
          <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">Pengguna</h1>
          <p className="mt-1 text-[15px] text-muted">
            {result.total} pengguna pada {session.organization.name}.
          </p>
        </div>
        {canInvite ? (
          <Link
            className="flex h-10 items-center justify-center gap-2 self-start rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring sm:self-auto"
            href="/users/invite"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Undang pengguna
          </Link>
        ) : null}
      </header>

      <section className="rounded-panel border border-line bg-surface">
        <form
          action="/users"
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end"
          method="get"
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="q">
              Cari
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted">
                search
              </span>
              <input
                className="h-10 w-full rounded-control border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
                defaultValue={query.q}
                id="q"
                maxLength={100}
                name="q"
                placeholder="Nama atau email"
                type="search"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="role">
              Role
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
              defaultValue={query.role ?? ""}
              id="role"
              name="role"
            >
              <option value="">Semua role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="status">
              Status
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
              defaultValue={query.status ?? ""}
              id="status"
              name="status"
            >
              <option value="">Semua status</option>
              {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink" htmlFor="branch">
              Cabang
            </label>
            <select
              className="h-10 rounded-control border border-line bg-white px-3 text-sm text-ink focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
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
          <button
            className="h-10 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-black focus-ring"
            type="submit"
          >
            Terapkan
          </button>
          <Link
            className="flex h-10 items-center justify-center rounded-control px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-ink focus-ring"
            href="/users"
          >
            Reset
          </Link>
        </form>

        {result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss text-forest">
              <span className="material-symbols-outlined">group_off</span>
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink">Tidak ada pengguna</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted">
              {query.q || query.role || query.status || query.branch
                ? "Tidak ada pengguna yang cocok dengan filter ini. Coba longgarkan filter."
                : "Belum ada anggota tim pada organisasi ini. Mulai dengan mengundang pengguna."}
            </p>
            {canInvite ? (
              <Link
                className="mt-4 flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
                href="/users/invite"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Undang pengguna
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">
                    <Link className="inline-flex items-center gap-1 hover:text-ink" href={sortHref("name")}>
                      Pengguna
                      {sortIndicator("name") ? (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortIndicator("name")}
                        </span>
                      ) : null}
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link className="inline-flex items-center gap-1 hover:text-ink" href={sortHref("role")}>
                      Role
                      {sortIndicator("role") ? (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortIndicator("role")}
                        </span>
                      ) : null}
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">
                    <Link className="inline-flex items-center gap-1 hover:text-ink" href={sortHref("status")}>
                      Status
                      {sortIndicator("status") ? (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortIndicator("status")}
                        </span>
                      ) : null}
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      className="inline-flex items-center gap-1 hover:text-ink"
                      href={sortHref("lastLogin")}
                    >
                      Login terakhir
                      {sortIndicator("lastLogin") ? (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortIndicator("lastLogin")}
                        </span>
                      ) : null}
                    </Link>
                  </th>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((user) => {
                  const status = user.status as UserStatus;
                  return (
                    <tr className="group transition-colors hover:bg-paper" key={user.membershipId}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss text-[11px] font-semibold text-forest">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                            <p className="truncate text-[12px] text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-ink">{user.role.name}</td>
                      <td className="px-4 py-3.5 text-[13px] text-secondary">
                        {user.branch?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle(status)}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                          {USER_STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-muted">
                        {user.lastLoginAt ? formatRelative(new Date(user.lastLoginAt)) : "Belum pernah"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          aria-label={`Lihat ${user.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-muted hover:text-ink focus-ring"
                          href={`/users/${user.id}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12px] text-muted sm:flex-row">
          <span>
            Menampilkan {result.items.length === 0 ? 0 : (page - 1) * result.pageSize + 1}–
            {(page - 1) * result.pageSize + result.items.length} dari {result.total}
          </span>
          <div className="flex items-center gap-1">
            <Link
              aria-disabled={page <= 1}
              className={`flex h-8 items-center gap-1 rounded-control border border-line px-2.5 ${
                page <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted hover:text-ink"
              }`}
              href={href({ page: Math.max(1, page - 1) })}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Sebelumnya
            </Link>
            <span className="px-2 text-ink">
              {page} / {totalPages}
            </span>
            <Link
              aria-disabled={page >= totalPages}
              className={`flex h-8 items-center gap-1 rounded-control border border-line px-2.5 ${
                page >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted hover:text-ink"
              }`}
              href={href({ page: Math.min(totalPages, page + 1) })}
            >
              Berikutnya
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
