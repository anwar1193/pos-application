import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSettingsOverview } from "@/lib/settings/service";
import { PageHeader, Panel } from "@/components/ui";
import { OrganizationForm } from "./organization-form";
import { BranchesManager } from "./branches-manager";
import { PaymentMethodsManager } from "./payment-methods-manager";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "organization", label: "Profil bisnis", icon: "storefront" },
  { key: "branches", label: "Cabang", icon: "store" },
  { key: "payment-methods", label: "Metode pembayaran", icon: "payments" },
] as const;

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission(PERMISSIONS.settingsManage, "/settings");
  const raw = await searchParams;
  const requested = str(raw.tab);
  const tab = TABS.some((item) => item.key === requested) ? requested! : "organization";
  const overview = await getSettingsOverview(session);

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Pengaturan"
        title="Pengaturan bisnis"
        description="Kelola profil bisnis, cabang, dan metode pembayaran untuk seluruh organisasi."
      />

      <nav
        aria-label="Bagian pengaturan"
        className="mb-5 flex flex-wrap items-center gap-1 rounded-panel border border-line bg-surface p-1"
      >
        {TABS.map((item) => (
          <Link
            aria-current={tab === item.key ? "page" : undefined}
            className={`flex h-9 items-center gap-2 rounded-control px-3 text-[13px] font-semibold ${
              tab === item.key
                ? "bg-forest text-white"
                : "text-secondary hover:bg-surface-muted hover:text-ink"
            }`}
            href={`/settings?tab=${item.key}`}
            key={item.key}
          >
            <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "organization" ? (
        <OrganizationForm
          organization={{
            name: overview.organization.name,
            phone: overview.organization.phone,
            address: overview.organization.address,
            timezone: overview.organization.timezone,
            currency: overview.organization.currency,
            receiptPrefix: overview.organization.receiptPrefix,
            taxRate: overview.organization.taxRate,
            allowNegativeStock: overview.organization.allowNegativeStock,
            slug: overview.organization.slug,
          }}
        />
      ) : null}

      {tab === "branches" ? (
        <BranchesManager
          branches={overview.branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            phone: branch.phone,
            address: branch.address,
            isActive: branch.isActive,
          }))}
        />
      ) : null}

      {tab === "payment-methods" ? (
        <PaymentMethodsManager
          methods={overview.paymentMethods.map((method) => ({
            id: method.id,
            code: method.code,
            name: method.name,
            sortOrder: method.sortOrder,
            isActive: method.isActive,
          }))}
        />
      ) : null}

      {tab === "organization" ? (
        <Panel className="mt-5">
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Tim dan akses</h2>
              <p className="text-[12px] text-muted">
                Undang pengguna, atur peran, dan nonaktifkan akses dari halaman pengguna.
              </p>
            </div>
            <Link
              className="flex h-9 shrink-0 items-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
              href="/users"
            >
              <span className="material-symbols-outlined text-[17px]">group</span>
              Kelola pengguna
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
