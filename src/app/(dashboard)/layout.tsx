import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requirePageSession } from "@/lib/auth/guard";
import { listBranches } from "@/lib/users/service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession("/dashboard");
  const branches = await listBranches(session);

  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <AdminShell
        branches={branches}
        session={{
          user: { name: session.user.name, email: session.user.email },
          organization: { name: session.organization.name },
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
