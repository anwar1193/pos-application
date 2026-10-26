import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireApiPermission } from "@/lib/auth/guard";
import { getManagerBranchIds } from "@/lib/auth/scope";
import type { SessionContext } from "@/lib/auth/session";
import {
  auditLogs,
  branches,
  invitations,
  memberships,
  roles,
  sessions,
  users,
} from "@/db/schema";

export type DashboardSummary = {
  organization: { id: string; name: string };
  branchCount: number;
  userCounts: { active: number; invited: number; suspended: number };
  usersByRole: { role: string; name: string; count: number }[];
  pendingInvitations: number;
  activeSessions24h: number;
  recentLogins: {
    id: string;
    action: string;
    actorUserId: string | null;
    actorName: string | null;
    createdAt: Date;
    metadata: string | null;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    actorName: string | null;
    createdAt: Date;
    metadata: string | null;
  }[];
};

export async function getDashboardSummary(
  session: SessionContext,
  options: { branchId?: string | null } = {},
  db: Database = getDb(),
): Promise<DashboardSummary> {
  requireApiPermission(session, PERMISSIONS.dashboardView);
  const organizationId = session.organization.id;
  const branchId = options.branchId ?? null;
  const managerBranchIds =
    session.membership.roleCode === "manager" ? await getManagerBranchIds(session, db) : null;

  const branchConditions: SQL[] = [
    eq(branches.organizationId, organizationId),
    eq(branches.isActive, true),
  ];
  if (branchId) {
    branchConditions.push(eq(branches.id, branchId));
  }
  if (managerBranchIds) {
    if (managerBranchIds.length === 0) {
      branchConditions.push(sql`1 = 0`);
    } else {
      branchConditions.push(inArray(branches.id, managerBranchIds));
    }
  }
  const branchRows = await db
    .select({ value: count() })
    .from(branches)
    .where(and(...branchConditions));

  const membershipScope = [eq(memberships.organizationId, organizationId)];
  if (branchId) membershipScope.push(eq(memberships.defaultBranchId, branchId));
  if (managerBranchIds) {
    membershipScope.push(
      managerBranchIds.length === 0
        ? sql`1 = 0`
        : inArray(memberships.defaultBranchId, managerBranchIds),
    );
  }

  const statusRows = await db
    .select({ status: memberships.status, value: count() })
    .from(memberships)
    .where(and(...membershipScope))
    .groupBy(memberships.status);
  const userCounts = { active: 0, invited: 0, suspended: 0 };
  for (const row of statusRows) {
    if (row.status === "active") userCounts.active = row.value;
    if (row.status === "invited") userCounts.invited = row.value;
    if (row.status === "suspended") userCounts.suspended = row.value;
  }

  const roleRows = await db
    .select({ role: roles.code, name: roles.name, value: count() })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(...membershipScope))
    .groupBy(roles.code, roles.name)
    .orderBy(asc(roles.name));

  const invitationScope: SQL[] = [
    eq(invitations.organizationId, organizationId),
    eq(invitations.status, "pending"),
    sql`${invitations.expiresAt} > ${Date.now()}`,
  ];
  if (branchId) invitationScope.push(eq(invitations.branchId, branchId));
  if (managerBranchIds) {
    invitationScope.push(
      managerBranchIds.length === 0
        ? sql`1 = 0`
        : inArray(invitations.branchId, managerBranchIds),
    );
  }
  const invitationRows = await db
    .select({ value: count() })
    .from(invitations)
    .where(and(...invitationScope));

  const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sessionScope: SQL[] = [
    eq(sessions.organizationId, organizationId),
    isNull(sessions.revokedAt),
    gte(sessions.lastSeenAt, activeSince),
  ];
  if (branchId) {
    sessionScope.push(
      sql`${sessions.userId} in (
        select m.user_id from memberships m
        where m.organization_id = ${organizationId} and m.default_branch_id = ${branchId}
      )`,
    );
  }
  if (managerBranchIds) {
    sessionScope.push(
      managerBranchIds.length === 0
        ? sql`1 = 0`
        : sql`${sessions.userId} in (
            select m.user_id from memberships m
            where m.organization_id = ${organizationId}
              and m.default_branch_id in (${sql.join(
                managerBranchIds.map((id) => sql`${id}`),
                sql`, `,
              )})
          )`,
    );
  }
  const sessionRows = await db
    .select({ value: countDistinct(sessions.userId) })
    .from(sessions)
    .where(and(...sessionScope));

  const activityConditions: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (branchId) activityConditions.push(eq(auditLogs.branchId, branchId));
  if (managerBranchIds) {
    activityConditions.push(
      managerBranchIds.length === 0
        ? sql`1 = 0`
        : inArray(auditLogs.branchId, managerBranchIds),
    );
  }

  const recentActivity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorUserId: auditLogs.actorUserId,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(and(...activityConditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const loginConditions = [...activityConditions, eq(auditLogs.action, "auth.login.success")];
  const recentLogins = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorUserId: auditLogs.actorUserId,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(and(...loginConditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const actorIds = [
    ...new Set(
      [...recentActivity, ...recentLogins]
        .map((row) => row.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actorRows =
    actorIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, actorIds))
      : [];
  const actorNames = new Map(actorRows.map((row) => [row.id, row.name]));

  return {
    organization: { id: session.organization.id, name: session.organization.name },
    branchCount: branchRows[0]?.value ?? 0,
    userCounts,
    usersByRole: roleRows.map((r) => ({ role: r.role, name: r.name, count: r.value })),
    pendingInvitations: invitationRows[0]?.value ?? 0,
    activeSessions24h: sessionRows[0]?.value ?? 0,
    recentLogins: recentLogins.map((row) => ({
      ...row,
      actorName: row.actorUserId ? actorNames.get(row.actorUserId) ?? null : null,
    })),
    recentActivity: recentActivity.map((row) => ({
      ...row,
      actorName: row.actorUserId ? actorNames.get(row.actorUserId) ?? null : null,
    })),
  };
}
