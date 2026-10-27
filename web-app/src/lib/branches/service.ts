import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { getManagerBranchIds } from "@/lib/auth/scope";
import type { SessionContext } from "@/lib/auth/session";
import { ERRORS } from "@/lib/http/errors";
import { memberBranches, branches } from "@/db/schema";

export type BranchOption = { id: string; name: string; code: string };

/**
 * Branches the signed-in user may work with:
 * - owner/admin: every active branch
 * - manager: explicitly assigned branches plus the default branch
 * - cashier/warehouse: only the default branch
 */
export async function getAllowedBranchIds(
  session: SessionContext,
  db: Database = getDb(),
): Promise<string[]> {
  const role = session.membership.roleCode;
  if (role === "owner" || role === "admin") {
    const rows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(eq(branches.organizationId, session.organization.id), eq(branches.isActive, true)),
      );
    return rows.map((row) => row.id);
  }

  if (role === "manager") {
    const ids = await getManagerBranchIds(session, db);
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.organizationId, session.organization.id),
          eq(branches.isActive, true),
          inArray(branches.id, ids),
        ),
      );
    return rows.map((row) => row.id);
  }

  if (!session.membership.defaultBranchId) return [];
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.organizationId, session.organization.id),
        eq(branches.isActive, true),
        eq(branches.id, session.membership.defaultBranchId),
      ),
    );
  return rows.map((row) => row.id);
}

export async function listShellBranches(
  session: SessionContext,
  db: Database = getDb(),
): Promise<BranchOption[]> {
  const allowed = await getAllowedBranchIds(session, db);
  if (allowed.length === 0) return [];
  return db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(
      and(
        eq(branches.organizationId, session.organization.id),
        eq(branches.isActive, true),
        inArray(branches.id, allowed),
      ),
    )
    .orderBy(asc(branches.name));
}

/** Resolve a requested branch, falling back to the user's default/first allowed branch. */
export async function resolveBranchId(
  session: SessionContext,
  requested: string | null | undefined,
  db: Database = getDb(),
): Promise<string> {
  const allowed = await getAllowedBranchIds(session, db);
  if (allowed.length === 0) {
    throw ERRORS.forbidden("Anda tidak memiliki akses ke cabang mana pun.");
  }
  if (requested) {
    if (!allowed.includes(requested)) {
      throw ERRORS.forbidden("Anda tidak memiliki akses ke cabang tersebut.");
    }
    return requested;
  }
  const preferred = session.membership.defaultBranchId;
  if (preferred && allowed.includes(preferred)) return preferred;
  return allowed[0]!;
}

export async function requireBranchAccess(
  session: SessionContext,
  branchId: string,
  db: Database = getDb(),
): Promise<void> {
  if (!branchId) throw ERRORS.validation({ branchId: "Cabang wajib dipilih." });
  const allowed = await getAllowedBranchIds(session, db);
  if (!allowed.includes(branchId)) {
    throw ERRORS.forbidden("Anda tidak memiliki akses ke cabang tersebut.");
  }
}

/** Assignments granted to a membership, used by the user-management screens. */
export async function listMembershipBranches(
  membershipId: string,
  db: Database = getDb(),
): Promise<BranchOption[]> {
  return db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(memberBranches)
    .innerJoin(branches, eq(branches.id, memberBranches.branchId))
    .where(eq(memberBranches.membershipId, membershipId))
    .orderBy(asc(branches.name));
}
