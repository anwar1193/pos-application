import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listShellBranches, resolveBranchId } from "@/lib/branches/service";
import { getCurrentShift } from "@/lib/shifts/service";
import { getOrganizationConfig, listPaymentMethods } from "@/lib/settings/service";
import { PosClient } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await requirePagePermission(PERMISSIONS.saleCreate, "/pos");
  const params = await searchParams;
  const [branches, branchId] = await Promise.all([
    listShellBranches(session),
    resolveBranchId(session, params.branch),
  ]);
  const [shift, methods, config] = await Promise.all([
    getCurrentShift(session, branchId),
    listPaymentMethods(session),
    getOrganizationConfig(session.organization.id),
  ]);
  const branch = branches.find((item) => item.id === branchId);

  return (
    <PosClient
      branchId={branchId}
      branchName={branch?.name ?? "Cabang"}
      currency={session.organization.currency}
      permissions={session.permissions}
      defaultTaxRate={config.taxRate}
      paymentMethods={methods.map((method) => ({ code: method.code, name: method.name }))}
      shift={
        shift
          ? {
              id: shift.id,
              openedAt: shift.openedAt.toISOString(),
              openingAmount: shift.openingAmount,
              expectedAmount: shift.expectedAmount,
              transactionCount: shift.transactionCount,
              grossTotal: shift.grossTotal,
            }
          : null
      }
    />
  );
}
