import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getDashboardSummary } from "@/lib/dashboard/service";
import { formatDateLong, formatTime } from "@/lib/format";
import { ActivityPanel } from "./activity-panel";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = typeof params.branch === "string" ? params.branch : undefined;
  const session = await requirePagePermission("dashboard.view", "/dashboard");
  const summary = await getDashboardSummary(session, { branchId });
  const now = new Date();
  const totalUsers =
    summary.userCounts.active + summary.userCounts.invited + summary.userCounts.suspended;
  const roleTotal = summary.usersByRole.reduce((sum, role) => sum + role.count, 0);
  const canInvite = session.permissions.includes(PERMISSIONS.userInvite);
  const timeZoneLabel =
    new Intl.DateTimeFormat("id-ID", {
      timeZone: session.organization.timezone,
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ??
    session.organization.timezone;
  const activityRows = summary.recentActivity.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actorName,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata,
  }));

  const stats = [
    {
      label: "Pengguna aktif",
      value: summary.userCounts.active,
      icon: "badge",
      caption: `dari ${totalUsers} pengguna`,
      footer: `${summary.userCounts.suspended} akun nonaktif`,
      footerIcon: "info",
      tone: "text-muted",
    },
    {
      label: "Undangan tertunda",
      value: summary.pendingInvitations,
      icon: "mail",
      caption: "menunggu verifikasi",
      footer: "tautan berlaku 7 hari",
      footerIcon: "timer",
      tone: summary.pendingInvitations > 0 ? "text-amber" : "text-muted",
    },
    {
      label: "Sesi aktif 24 jam",
      value: summary.activeSessions24h,
      icon: "devices",
      caption: "unik per pengguna",
      footer: "diperbarui otomatis",
      footerIcon: "fingerprint",
      tone: "text-muted",
    },
    {
      label: "Cabang aktif",
      value: summary.branchCount,
      icon: "domain",
      caption: "outlet operasional",
      footer: "sesuai scope akses",
      footerIcon: "store",
      tone: "text-muted",
    },
  ];

  return (
    <div className="mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">
            Ikhtisar Toko &amp; Akses
          </p>
          <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">Dashboard</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-medium text-ink">
              Selamat datang, {session.user.name.split(/\s+/)[0]}.
            </p>
            <span className="text-line-strong">•</span>
            <p className="text-[15px] text-muted">Ringkasan operasional {session.organization.name}.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start rounded-lg border border-line bg-surface px-3.5 py-2 md:self-auto">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-success">
              Sesi terverifikasi
            </span>
          </div>
          <div className="h-3.5 w-px bg-line" />
          <div className="flex items-center gap-1.5 text-muted">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span className="text-[13px] text-ink">
              {formatDateLong(now, session.organization.timezone)} ·{" "}
              {formatTime(now, session.organization.timezone)} {timeZoneLabel}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-label="Statistik operasional"
        className="mb-8 w-full overflow-hidden rounded-panel border border-line bg-surface"
      >
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {stats.map((stat) => (
            <div className="flex flex-col justify-between p-6" key={stat.label}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-secondary">{stat.label}</span>
                <span className="material-symbols-outlined text-[18px] text-muted">
                  {stat.icon}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tracking-tight text-ink">
                  {stat.value}
                </span>
                <span className="text-[12px] text-muted">{stat.caption}</span>
              </div>
              <div className="mt-4 flex items-center border-t border-surface-muted pt-3 text-[12px]">
                <span className={`flex items-center gap-1 ${stat.tone}`}>
                  <span className="material-symbols-outlined text-[14px]">{stat.footerIcon}</span>
                  {stat.footer}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <ActivityPanel rows={activityRows} timeZone={session.organization.timezone} />

        <div className="flex flex-col gap-6 lg:col-span-4">
          <section
            aria-labelledby="roles-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink" id="roles-heading">
                  Distribusi role
                </h2>
                <p className="mt-0.5 text-[12px] text-muted">Komposisi akses tim</p>
              </div>
              <span className="rounded-full bg-moss px-2.5 py-1 text-[11px] font-medium text-ink">
                {roleTotal} terdaftar
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              {summary.usersByRole.length === 0 ? (
                <p className="text-sm text-muted">Belum ada membership pada scope ini.</p>
              ) : (
                summary.usersByRole.map((role) => {
                  const percent = roleTotal === 0 ? 0 : (role.count / roleTotal) * 100;
                  return (
                    <div key={role.role}>
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className="font-medium text-ink">{role.name}</span>
                        <span className="text-muted">{role.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-forest"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section
            aria-labelledby="actions-heading"
            className="rounded-panel border border-line bg-surface p-6"
          >
            <h2 className="text-xl font-semibold tracking-tight text-ink" id="actions-heading">
              Aksi cepat
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">Langkah operasional yang tersedia</p>
            <div className="mt-4 flex flex-col gap-2">
              {canInvite ? (
                <Link
                  className="flex h-10 items-center justify-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
                  href="/users/invite"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Undang pengguna
                </Link>
              ) : null}
              <Link
                className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
                href="/users"
              >
                <span className="material-symbols-outlined text-[18px]">group</span>
                Lihat pengguna
              </Link>
            </div>
          </section>

          <section className="rounded-panel border border-line bg-surface-muted p-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-forest">shield_lock</span>
              <div>
                <h2 className="text-[13px] font-semibold text-ink">Integritas sesi admin</h2>
                <p className="mt-1 text-[12px] leading-5 text-secondary">
                  Setiap session divalidasi di server pada tiap request. Role Anda saat ini:{" "}
                  <span className="font-semibold text-ink">{session.membership.roleName}</span>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
