import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { memberBranches } from "@/db/schema";
import type { SessionContext } from "@/lib/auth/session";

/** Manager access is limited to explicitly assigned branches plus the default branch. */
export async function getManagerBranchIds(
  session: SessionContext,
  db: Database,
): Promise<string[]> {
  if (session.membership.roleCode !== "manager") return [];
  const rows = await db
    .select({ branchId: memberBranches.branchId })
    .from(memberBranches)
    .where(eq(memberBranches.membershipId, session.membership.id));
  const ids = new Set(rows.map((r) => r.branchId));
  if (session.membership.defaultBranchId) ids.add(session.membership.defaultBranchId);
  return [...ids];
}
