import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/errors";
import { formatDateLong, formatDateTime, formatRelative, initials } from "@/lib/format";
import { USER_STATUS_LABELS, statusDot, statusStyle, type UserStatus } from "@/lib/users/labels";
import { getUserDetail, listBranches, listRoles } from "@/lib/users/service";
import { UserActions } from "./user-actions";
import { UserEditForm } from "./user-edit-form";

export const dynamic = "force-dynamic";

function activityLabel(action: string): string {
  const labels: Record<string, string> = {
    "auth.login.success": "Login berhasil",
    "auth.login.failed": "Percobaan login gagal",
    "auth.logout": "Logout dari perangkat",
    "auth.logout_all": "Logout dari semua perangkat",
    "user.invited": "Undangan dibuat",
    "user.invitation_accepted": "Undangan diterima",
    "user.updated": "Data pengguna diperbarui",
    "user.role_changed": "Role diubah",
    "user.deactivated": "Pengguna dinonaktifkan",
    "user.reactivated": "Pengguna diaktifkan",
    "user.password_reset_requested": "Tautan reset dibuat",
    "user.password_changed": "Password diubah",
    "session.revoked": "Sesi dicabut",
    "invitation.revoked": "Undangan dicabut",
  };
  return labels[action] ?? action;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission(PERMISSIONS.userView, "/users");
  const { id } = await params;

  let detail;
  try {
    detail = await getUserDetail(session, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [roles, branches] = await Promise.all([listRoles(session), listBranches(session)]);
  const status = detail.status as UserStatus;
  const actorRole = session.membership.roleCode;
  const isSelf = detail.id === session.user.id;
  const ownerBlocked = detail.role.code === "owner" && actorRole !== "owner";
  const has = (permission: string) => session.permissions.includes(permission);
  const canUpdate = has(PERMISSIONS.userUpdate) && !ownerBlocked;
  const canEditRole =
    canUpdate && !isSelf && (actorRole === "owner" || !["owner", "admin"].includes(detail.role.code));
  const canDeactivate = has(PERMISSIONS.userDeactivate) && !isSelf && !ownerBlocked;
  const canReset = has(PERMISSIONS.userResetPassword) && !ownerBlocked;
  const canRevokeSessions = has(PERMISSIONS.sessionRevoke) && !ownerBlocked;
  const canRevokeInvite = has(PERMISSIONS.userInvite);
  const timeZone = session.organization.timezone;

  return (
    <div className="mx-auto max-w-[1180px] p-4 sm:p-6 lg:p-8">
      <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-muted">
        <Link className="hover:text-ink" href="/users">
          Pengguna
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="truncate text-ink">{detail.name}</span>
      </nav>

      <header className="mb-6 flex flex-col justify-between gap-4 rounded-panel border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-moss text-base font-semibold text-forest">
            {initials(detail.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[26px] font-semibold leading-8 tracking-tight text-ink">
                {detail.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle(status)}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                {USER_STATUS_LABELS[status]}
              </span>
            </div>
            <p className="truncate text-sm text-muted">{detail.email}</p>
            <p className="mt-1 text-[12px] text-secondary">
              {detail.role.name}
              {detail.branch ? ` · ${detail.branch.name}` : " · Tanpa cabang default"}
            </p>
          </div>
        </div>
        <Link
          className="flex h-10 items-center justify-center gap-2 self-start rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring sm:self-auto"
          href="/users"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Daftar pengguna
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {canUpdate ? (
            <UserEditForm
              branches={branches}
              canEditRole={canEditRole}
              isSelf={isSelf}
              roles={roles}
              user={{
                name: detail.name,
                phone: detail.phone,
                roleId: detail.role.id,
                branchId: detail.branch?.id ?? null,
              }}
              userId={detail.id}
            />
          ) : (
            <section className="rounded-panel border border-line bg-surface p-6">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Data pengguna</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {ownerBlocked
                  ? "Akun Owner hanya dapat dikelola oleh Owner lain."
                  : "Role Anda tidak memiliki izin untuk mengubah data pengguna."}
              </p>
            </section>
          )}

          <section className="rounded-panel border border-line bg-surface p-6">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Aktivitas terkait</h2>
            <p className="mt-0.5 text-[12px] text-muted">Sepuluh catatan audit terakhir.</p>
            {detail.recentActivity.length === 0 ? (
              <p className="mt-4 rounded-control bg-surface-muted p-3 text-[12px] text-secondary">
                Belum ada aktivitas tercatat untuk pengguna ini.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-line">
                {detail.recentActivity.map((row) => (
                  <div className="flex items-start justify-between gap-4 py-3" key={row.id}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{activityLabel(row.action)}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {row.entityType}
                        {row.entityId ? ` · ${row.entityId.slice(0, 18)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted" title={formatDateTime(new Date(row.createdAt), timeZone)}>
                      {formatRelative(new Date(row.createdAt))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-panel border border-line bg-surface p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">
              Ringkasan akun
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-[13px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Telepon</dt>
                <dd className="text-right font-medium text-ink">{detail.phone ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Role</dt>
                <dd className="text-right font-medium text-ink">{detail.role.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Cabang</dt>
                <dd className="text-right font-medium text-ink">
                  {detail.branch?.name ?? "Tanpa cabang"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Sesi aktif</dt>
                <dd className="text-right font-medium text-ink">{detail.activeSessions}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Bergabung</dt>
                <dd className="text-right font-medium text-ink">
                  {formatDateLong(new Date(detail.joinedAt), timeZone)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Login terakhir</dt>
                <dd className="text-right font-medium text-ink">
                  {detail.lastLoginAt
                    ? formatDateTime(new Date(detail.lastLoginAt), timeZone)
                    : "Belum pernah"}
                </dd>
              </div>
            </dl>
          </section>

          <UserActions
            activeSessions={detail.activeSessions}
            canDeactivate={canDeactivate}
            canResetPassword={canReset}
            canRevokeInvite={canRevokeInvite}
            canRevokeSessions={canRevokeSessions}
            isSelf={isSelf}
            name={detail.name}
            pendingInvitationId={detail.pendingInvitationId}
            status={status}
            userId={detail.id}
          />
        </div>
      </div>
    </div>
  );
}
