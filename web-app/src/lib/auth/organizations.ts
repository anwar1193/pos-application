import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { createSession, revokeSession, type SessionContext } from "@/lib/auth/session";
import { canUseWebAdmin, homePathFor } from "@/lib/auth/permissions";
import { ERRORS } from "@/lib/http/errors";
import { memberships, organizations, roles } from "@/db/schema";

export type OrganizationOption = {
  id: string;
  name: string;
  roleCode: string;
  roleName: string;
};

/** Organizations this user can actually open in the web admin. */
export async function listUserOrganizations(
  userId: string,
  db: Database = getDb(),
): Promise<OrganizationOption[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")))
    .orderBy(asc(organizations.name));

  return rows.filter((row) => canUseWebAdmin(row.roleCode));
}

/**
 * Moves the current browser session to another organization the user belongs
 * to. The old session is revoked first, so a failure leaves the browser with a
 * dead token rather than a silently still-valid old scope.
 */
export async function switchOrganization(
  session: SessionContext,
  organizationId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
): Promise<{ token: string | null; absoluteExpiresAt: Date | null; redirectTo: string }> {
  if (organizationId === session.organization.id) {
    return {
      token: null,
      absoluteExpiresAt: null,
      redirectTo: homePathFor(session.membership.roleCode),
    };
  }

  const target = (
    await db
      .select({ roleCode: roles.code, organizationName: organizations.name })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.organizationId, organizationId),
          eq(memberships.status, "active"),
          eq(organizations.status, "active"),
        ),
      )
      .limit(1)
  )[0];

  if (!target || !canUseWebAdmin(target.roleCode)) {
    throw ERRORS.forbidden("Anda tidak memiliki akses ke organisasi ini.");
  }

  await revokeSession(session.sessionId, "organization_switch", db);
  const created = await createSession({
    userId: session.user.id,
    organizationId,
    userAgent: meta.userAgent,
    ipHash: meta.ipHash,
    db,
  });

  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "auth.organization_switched",
      entityType: "session",
      entityId: created.sessionId,
      metadata: {
        requestId: meta.requestId,
        previousOrganizationId: session.organization.id,
        organizationName: target.organizationName,
      },
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
    db,
  );

  return {
    token: created.token,
    absoluteExpiresAt: created.absoluteExpiresAt,
    redirectTo: homePathFor(target.roleCode),
  };
}
