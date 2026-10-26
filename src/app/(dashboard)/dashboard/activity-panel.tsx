"use client";

import { useMemo, useState } from "react";

export type ActivityRow = {
  id: string;
  action: string;
  actorName: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  metadata: string | null;
};

const LOGIN_ACTIONS = new Set(["auth.login.success", "auth.login.failed"]);

function metadataValue(metadata: string | null, key: string): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const value = parsed[key];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function actionLabel(row: ActivityRow): { text: string; badge: string; kind: "success" | "neutral" | "warning" | "danger" } {
  const actor = row.actorName ?? "Sistem";
  switch (row.action) {
    case "auth.login.success":
      return { text: `${actor} masuk melalui sesi Web.`, badge: "Login", kind: "success" };
    case "auth.login.failed":
      return { text: `Percobaan login gagal untuk ${actor}.`, badge: "Gagal", kind: "danger" };
    case "auth.logout":
      return { text: `${actor} keluar dari perangkat ini.`, badge: "Logout", kind: "neutral" };
    case "auth.logout_all":
      return { text: `${actor} keluar dari semua perangkat.`, badge: "Logout", kind: "warning" };
    case "user.invited":
      return {
        text: `${actor} mengundang ${metadataValue(row.metadata, "email") ?? "pengguna baru"}.`,
        badge: "Undangan",
        kind: "neutral",
      };
    case "user.invitation_accepted":
      return { text: `${actor} menerima undangan dan mengaktifkan akun.`, badge: "Aktif", kind: "success" };
    case "user.updated":
      return { text: `${actor} memperbarui data pengguna.`, badge: "Perubahan", kind: "neutral" };
    case "user.role_changed":
      return { text: `${actor} mengubah role pengguna.`, badge: "Otoritas", kind: "warning" };
    case "user.deactivated":
      return { text: `${actor} menonaktifkan akun pengguna.`, badge: "Nonaktif", kind: "danger" };
    case "user.reactivated":
      return { text: `${actor} mengaktifkan kembali akun pengguna.`, badge: "Aktif", kind: "success" };
    case "user.password_reset_requested":
      return { text: `${actor} membuat tautan reset password.`, badge: "Keamanan", kind: "warning" };
    case "user.password_changed":
      return { text: `${actor} mengubah kata sandi akun.`, badge: "Keamanan", kind: "warning" };
    case "session.revoked":
      return { text: `${actor} mencabut sesi pengguna.`, badge: "Sesi", kind: "warning" };
    case "invitation.revoked":
      return { text: `${actor} mencabut undangan pengguna.`, badge: "Undangan", kind: "danger" };
    default:
      return { text: `${actor} melakukan ${row.action.replaceAll(".", " ")}.`, badge: "Aktivitas", kind: "neutral" };
  }
}

export function ActivityPanel({
  rows,
  timeZone,
}: {
  rows: ActivityRow[];
  timeZone: string;
}) {
  const [filter, setFilter] = useState<"all" | "login" | "users">("all");
  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "login") return rows.filter((row) => LOGIN_ACTIONS.has(row.action));
    return rows.filter((row) => !LOGIN_ACTIONS.has(row.action));
  }, [filter, rows]);

  const tabs = [
    { key: "all" as const, label: "Semua" },
    { key: "login" as const, label: "Login" },
    { key: "users" as const, label: "Perubahan" },
  ];

  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-panel border border-line bg-surface p-6 lg:col-span-8"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink" id="activity-heading">
            Aktivitas terbaru
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Catatan otentikasi dan mutasi akses tim
          </p>
        </div>
        <div
          className="flex items-center rounded-lg border border-line bg-surface-muted p-1 text-[13px]"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-selected={filter === tab.key}
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                filter === tab.key
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="material-symbols-outlined text-[28px] text-muted">history</span>
          <p className="mt-2 text-sm font-medium text-ink">Belum ada aktivitas</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
            Aktivitas login dan perubahan akses akan muncul di sini setelah tim mulai menggunakan
            POS Admin.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((row) => {
            const label = actionLabel(row);
            const date = new Date(row.createdAt);
            const time = new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone,
            }).format(date);
            const badgeClass = {
              success: "bg-success-bg text-success",
              neutral: "bg-moss text-ink",
              warning: "bg-amber-bg text-amber",
              danger: "bg-brick-bg text-brick",
            }[label.kind];
            return (
              <article
                className="-mx-2 flex items-center justify-between rounded px-2 py-3.5 transition-colors hover:bg-paper"
                key={row.id}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="w-16 shrink-0 text-[12px] font-medium text-muted">{time}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moss text-[11px] font-semibold text-forest">
                    {(row.actorName ?? "Sistem")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")}
                  </span>
                  <p className="truncate text-[13px] text-ink">{label.text}</p>
                </div>
                <span
                  className={`ml-2 hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:inline-flex ${badgeClass}`}
                >
                  {label.badge}
                </span>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Menampilkan {filtered.length} aktivitas terakhir
        </span>
        <span>Zona waktu {timeZone}</span>
      </div>
    </section>
  );
}
