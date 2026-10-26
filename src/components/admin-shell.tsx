"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Branch = { id: string; name: string; code: string };

type AdminSession = {
  user: { name: string; email: string };
  organization: { name: string };
  membership: { roleName: string; roleCode: string; defaultBranchId: string | null };
  permissions: string[];
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminShell({
  session,
  branches,
  children,
}: {
  session: AdminSession;
  branches: Branch[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [busy, setBusy] = useState<"logout" | "logout-all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!logoutAllOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLogoutAllOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logoutAllOpen]);

  const currentBranchId = searchParams.get("branch") ?? session.membership.defaultBranchId;
  const currentBranch = branches.find((branch) => branch.id === currentBranchId) ?? branches[0];
  const canInvite = session.permissions.includes("user.invite");
  const active = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);

  async function logout(url: string, kind: "logout" | "logout-all") {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(url, { method: "POST", credentials: "same-origin" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? "Logout gagal.");
      }
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logout gagal.");
      setBusy(null);
    }
  }

  function branchHref(branchId: string): string {
    if (pathname.startsWith("/users")) return `/users?branch=${branchId}`;
    return `/dashboard?branch=${branchId}`;
  }

  const nav = (
    <>
      <div className="flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-[#23332A] px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-bold uppercase leading-none tracking-wider text-white">
              POS Admin
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#88C4A6]">
              Back-Office ID
            </span>
          </div>
        </div>
        <div className="px-4 pb-1 pt-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#5E7267]">
            Menu Operasional
          </p>
        </div>
        <nav className="flex flex-col gap-1 px-1">
          <Link
            aria-current={active("/dashboard") ? "page" : undefined}
            className={`flex items-center justify-between rounded px-4 py-2.5 transition-colors ${
              active("/dashboard")
                ? "border-l-[3px] border-[#E4EDE6] bg-forest font-semibold text-white"
                : "text-[#A6B7AC] hover:bg-[#1E2E25] hover:text-white"
            }`}
            href="/dashboard"
          >
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span className="text-[13px] font-medium">Dashboard</span>
            </span>
          </Link>
          <Link
            aria-current={active("/users") ? "page" : undefined}
            className={`flex items-center justify-between rounded px-4 py-2.5 transition-colors ${
              active("/users")
                ? "border-l-[3px] border-[#E4EDE6] bg-forest font-semibold text-white"
                : "text-[#A6B7AC] hover:bg-[#1E2E25] hover:text-white"
            }`}
            href="/users"
          >
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span className="text-[13px] font-medium">Pengguna</span>
            </span>
          </Link>
          <div className="flex cursor-not-allowed items-center justify-between rounded px-4 py-2.5 text-[#5E7267] opacity-75">
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span className="text-[13px] font-medium">Pengaturan</span>
            </span>
            <span className="rounded-full bg-[#1E2E25] px-2 py-0.5 text-[11px] leading-tight text-[#88C4A6]">
              Segera hadir
            </span>
          </div>
        </nav>
      </div>
      <div className="border-t border-[#23332A] bg-[#0E1813] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#23332A] bg-[#1E2E25] text-[11px] font-semibold text-white">
            {initials(session.user.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] leading-tight text-white">{session.user.name}</span>
            <span className="truncate text-[12px] leading-tight text-[#88C4A6]">
              {session.membership.roleName}
            </span>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#5E7267]">
            verified_user
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-[248px] select-none flex-col justify-between bg-sidebar lg:flex">
        {nav}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="relative flex h-full w-[280px] flex-col justify-between bg-sidebar">
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-surface px-4 lg:left-[248px] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Buka menu"
              className="flex h-9 w-9 items-center justify-center rounded text-secondary hover:bg-surface-muted focus-ring lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                Operasional
              </span>
              <span className="text-line-strong">/</span>
            </div>
            <span className="truncate text-base font-semibold text-ink">
              {pathname === "/dashboard"
                ? "Ringkasan Toko"
                : pathname.startsWith("/users/invite")
                  ? "Undang Pengguna"
                  : pathname.startsWith("/users/")
                    ? "Detail Pengguna"
                    : pathname.startsWith("/users")
                      ? "Pengguna"
                      : pathname.startsWith("/account")
                        ? "Akun"
                        : "POS Admin"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded border border-line bg-paper px-3 py-1.5 md:flex">
              <span className="material-symbols-outlined text-[18px] text-muted">storefront</span>
              <span className="text-[13px] font-semibold text-ink">{session.organization.name}</span>
            </div>
            {branches.length > 0 ? (
              <details className="relative hidden md:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded border border-line bg-paper px-3 py-1.5 focus-ring">
                  <span className="material-symbols-outlined text-[18px] text-muted">
                    location_on
                  </span>
                  <span className="text-[13px] font-semibold text-ink">
                    {currentBranch?.name ?? "Semua cabang"}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-muted">
                    expand_more
                  </span>
                </summary>
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded border border-line bg-surface py-1 shadow-overlay">
                  {branches.map((branch) => (
                    <Link
                      className={`block px-4 py-2 text-[13px] hover:bg-paper ${
                        branch.id === currentBranchId
                          ? "font-semibold text-forest"
                          : "text-ink"
                      }`}
                      href={branchHref(branch.id)}
                      key={branch.id}
                    >
                      {branch.name}
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="hidden h-6 w-px bg-line sm:block" />
            <div className="relative">
              <button
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label="Menu profil"
                className="flex items-center gap-2 rounded p-1 hover:bg-surface-muted focus-ring"
                onClick={() => setProfileOpen((value) => !value)}
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-moss text-[11px] font-semibold text-forest">
                  {initials(session.user.name)}
                </span>
                <span className="material-symbols-outlined text-[18px] text-muted">
                  keyboard_arrow_down
                </span>
              </button>
              {profileOpen ? (
                <>
                  <button
                    aria-label="Tutup menu profil"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setProfileOpen(false)}
                    tabIndex={-1}
                    type="button"
                  />
                  <div
                    className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded border border-line bg-surface py-1.5 shadow-overlay"
                    role="menu"
                  >
                    <div className="border-b border-line px-4 py-2">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {session.user.name}
                      </p>
                      <p className="truncate text-[12px] text-muted">{session.user.email}</p>
                    </div>
                    <Link
                      className="flex items-center gap-2 px-4 py-2 text-[13px] text-ink hover:bg-paper"
                      href="/account/password"
                      role="menuitem"
                    >
                      <span className="material-symbols-outlined text-[18px] text-muted">key</span>
                      Ganti password
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-ink hover:bg-paper disabled:opacity-60"
                      disabled={busy !== null}
                      onClick={() => logout("/api/auth/logout", "logout")}
                      role="menuitem"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px] text-muted">
                        logout
                      </span>
                      {busy === "logout" ? "Keluar..." : "Keluar"}
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-brick hover:bg-brick-bg"
                      onClick={() => {
                        setProfileOpen(false);
                        setLogoutAllOpen(true);
                        setError(null);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px] text-brick">
                        power_settings_new
                      </span>
                      Keluar dari semua perangkat
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {canInvite && pathname === "/users" ? (
          <div className="fixed bottom-4 right-4 z-30 lg:hidden">
            <Link
              className="flex h-12 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white shadow-overlay"
              href="/users/invite"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              Undang
            </Link>
          </div>
        ) : null}

        <main className="min-h-screen bg-paper pt-16">{children}</main>
      </div>

      {logoutAllOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            aria-label="Tutup dialog"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setLogoutAllOpen(false)}
            type="button"
          />
          <div
            aria-labelledby="logout-all-title"
            aria-modal="true"
            className="relative w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-overlay"
            role="dialog"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brick-bg text-brick">
                <span className="material-symbols-outlined">power_settings_new</span>
              </span>
              <div>
                <h2 className="text-xl font-semibold text-ink" id="logout-all-title">
                  Keluar dari semua perangkat?
                </h2>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Seluruh sesi aktif Anda di organisasi ini akan dicabut. Anda perlu masuk kembali
                  di setiap perangkat, termasuk perangkat ini.
                </p>
              </div>
            </div>
            {error ? <p className="mt-3 text-xs text-brick">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="h-10 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
                onClick={() => setLogoutAllOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-10 rounded-control bg-brick px-4 text-sm font-semibold text-white hover:bg-[#911E14] focus-ring disabled:opacity-70"
                disabled={busy === "logout-all"}
                onClick={() => logout("/api/auth/logout-all", "logout-all")}
                type="button"
              >
                {busy === "logout-all" ? "Memproses..." : "Ya, keluar semua"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
