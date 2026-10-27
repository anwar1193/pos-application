"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Branch = { id: string; name: string; code: string };
type Organization = { id: string; name: string; roleCode: string; roleName: string };

type AdminSession = {
  user: { name: string; email: string };
  organization: { id: string; name: string };
  membership: { roleName: string; roleCode: string; defaultBranchId: string | null };
  permissions: string[];
};

type NavItem = { href: string; label: string; icon: string; permission?: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operasional",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "dashboard.view" },
      { href: "/pos", label: "Kasir (POS)", icon: "point_of_sale", permission: "sale.create" },
    ],
  },
  {
    label: "Penjualan",
    items: [
      { href: "/sales", label: "Transaksi", icon: "receipt_long", permission: "sale.view" },
      { href: "/shifts", label: "Shift Kasir", icon: "schedule", permission: "shift.view" },
    ],
  },
  {
    label: "Katalog & Stok",
    items: [
      { href: "/catalog", label: "Produk", icon: "inventory_2", permission: "catalog.view" },
      {
        href: "/inventory",
        label: "Inventaris",
        icon: "warehouse",
        permission: "inventory.view",
      },
    ],
  },
  {
    label: "Relasi",
    items: [
      { href: "/customers", label: "Pelanggan", icon: "person", permission: "customer.view" },
      {
        href: "/suppliers",
        label: "Supplier",
        icon: "local_shipping",
        permission: "supplier.view",
      },
      {
        href: "/purchases",
        label: "Pembelian",
        icon: "shopping_cart",
        permission: "purchase.view",
      },
    ],
  },
  {
    label: "Wawasan",
    items: [{ href: "/reports", label: "Laporan", icon: "bar_chart", permission: "report.view" }],
  },
  {
    label: "Administrasi",
    items: [
      { href: "/users", label: "Pengguna", icon: "group", permission: "user.view" },
      { href: "/settings", label: "Pengaturan", icon: "settings", permission: "settings.manage" },
      { href: "/audit", label: "Audit Log", icon: "history", permission: "audit.view" },
    ],
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function pageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Ringkasan Toko";
  if (pathname === "/pos") return "Kasir";
  if (pathname === "/sales") return "Transaksi";
  if (pathname.startsWith("/sales/")) return "Detail Transaksi";
  if (pathname === "/shifts") return "Shift Kasir";
  if (pathname.startsWith("/shifts/")) return "Detail Shift";
  if (pathname === "/catalog") return "Produk";
  if (pathname.startsWith("/catalog/")) return "Detail Produk";
  if (pathname === "/inventory") return "Inventaris";
  if (pathname === "/customers") return "Pelanggan";
  if (pathname.startsWith("/customers/")) return "Detail Pelanggan";
  if (pathname === "/suppliers") return "Supplier";
  if (pathname.startsWith("/suppliers/")) return "Detail Supplier";
  if (pathname === "/purchases") return "Pembelian";
  if (pathname.startsWith("/purchases/")) return "Detail Pembelian";
  if (pathname === "/reports") return "Laporan";
  if (pathname === "/users/invite") return "Undang Pengguna";
  if (pathname.startsWith("/users/")) return "Detail Pengguna";
  if (pathname === "/users") return "Pengguna";
  if (pathname === "/settings") return "Pengaturan";
  if (pathname === "/audit") return "Audit Log";
  if (pathname.startsWith("/account")) return "Akun";
  return "POS Admin";
}

export function AdminShell({
  session,
  branches,
  organizations,
  children,
}: {
  session: AdminSession;
  branches: Branch[];
  organizations: Organization[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [busy, setBusy] = useState<"logout" | "logout-all" | null>(null);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);
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
  const active = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

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
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", branchId);
    return `${pathname}?${params.toString()}`;
  }

  async function switchOrg(organizationId: string) {
    setSwitchingOrg(organizationId);
    setError(null);
    try {
      const response = await fetch("/api/auth/switch-organization", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: { redirectTo?: string }; error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Gagal berpindah organisasi.");
      }
      router.replace(body?.data?.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal berpindah organisasi.");
    } finally {
      setSwitchingOrg(null);
    }
  }

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || session.permissions.includes(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const nav = (
    <>
      <div className="flex flex-col overflow-y-auto">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-[#23332A] px-4">
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
        <nav aria-label="Menu utama" className="flex flex-col gap-4 px-1 py-4">
          {visibleGroups.map((group) => (
            <div className="flex flex-col gap-1" key={group.label}>
              <p className="px-4 text-[11px] font-semibold uppercase tracking-wider text-[#5E7267]">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  aria-current={active(item.href) ? "page" : undefined}
                  className={`flex items-center justify-between rounded px-4 py-2.5 transition-colors ${
                    active(item.href)
                      ? "border-l-[3px] border-[#E4EDE6] bg-forest font-semibold text-white"
                      : "text-[#A6B7AC] hover:bg-[#1E2E25] hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <span className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
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
      <aside
        className="fixed left-0 top-0 z-50 hidden h-full w-[248px] select-none flex-col justify-between bg-sidebar lg:flex"
        data-print-hide
      >
        {nav}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" data-print-hide>
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
        <header
          className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-surface px-4 lg:left-[248px] lg:px-8"
          data-print-hide
        >
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
              {pageTitle(pathname)}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {organizations.length > 1 ? (
              <details className="relative hidden md:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded border border-line bg-paper px-3 py-1.5 focus-ring">
                  <span className="material-symbols-outlined text-[18px] text-muted">
                    storefront
                  </span>
                  <span className="text-[13px] font-semibold text-ink">
                    {session.organization.name}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-muted">
                    expand_more
                  </span>
                </summary>
                <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded border border-line bg-surface py-1 shadow-overlay">
                  {organizations.map((organization) => {
                    const current = organization.id === session.organization.id;
                    return (
                      <button
                        className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-paper disabled:cursor-default ${
                          current ? "font-semibold text-forest" : "text-ink"
                        }`}
                        disabled={current || switchingOrg !== null}
                        key={organization.id}
                        onClick={() => void switchOrg(organization.id)}
                        type="button"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px]">{organization.name}</span>
                          <span className="truncate text-[11px] font-normal text-muted">
                            {organization.roleName}
                          </span>
                        </span>
                        {switchingOrg === organization.id ? (
                          <span className="material-symbols-outlined animate-spin text-[16px] text-muted">
                            progress_activity
                          </span>
                        ) : current ? (
                          <span className="material-symbols-outlined text-[16px] text-forest">
                            check
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </details>
            ) : (
              <div className="hidden items-center gap-2 rounded border border-line bg-paper px-3 py-1.5 md:flex">
                <span className="material-symbols-outlined text-[18px] text-muted">storefront</span>
                <span className="text-[13px] font-semibold text-ink">
                  {session.organization.name}
                </span>
              </div>
            )}
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
                        branch.id === currentBranchId ? "font-semibold text-forest" : "text-ink"
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
                      href="/account"
                      role="menuitem"
                    >
                      <span className="material-symbols-outlined text-[18px] text-muted">
                        person
                      </span>
                      Profil saya
                    </Link>
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

      {error && !logoutAllOpen ? (
        <div
          className="fixed bottom-4 left-1/2 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-control bg-brick px-4 py-2 text-[13px] font-semibold text-white shadow-overlay"
          role="alert"
        >
          <span>{error}</span>
          <button
            aria-label="Tutup pesan"
            className="text-white/80 hover:text-white"
            onClick={() => setError(null)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : null}

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
