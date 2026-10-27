import { headers } from "next/headers";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requirePageSession } from "@/lib/auth/guard";
import { listUserOrganizations } from "@/lib/auth/organizations";
import { listShellBranches } from "@/lib/branches/service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const nextPath = requestHeaders.get("x-pos-path") ?? "/dashboard";
  const session = await requirePageSession(nextPath);
  const [branches, organizations] = await Promise.all([
    listShellBranches(session),
    listUserOrganizations(session.user.id),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <AdminShell
        branches={branches}
        organizations={organizations}
        session={{
          user: { name: session.user.name, email: session.user.email },
          organization: { id: session.organization.id, name: session.organization.name },
          membership: {
            roleName: session.membership.roleName,
            roleCode: session.membership.roleCode,
            defaultBranchId: session.membership.defaultBranchId,
          },
          permissions: session.permissions,
        }}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
