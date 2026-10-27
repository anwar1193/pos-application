import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { canUseWebAdmin } from "@/lib/auth/permissions";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import {
  memberships,
  organizations,
  permissions,
  rolePermissions,
  roles,
  sessions,
  users,
} from "@/db/schema";

export const SESSION_COOKIE = "pos_session";
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_WRITE_MS = 5 * 60 * 1000;

export type SessionContext = {
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    lastLoginAt: Date | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
  };
  membership: {
    id: string;
    roleId: string;
    roleCode: string;
    roleName: string;
    defaultBranchId: string | null;
    status: string;
  };
  permissions: string[];
};

export async function createSession(
  input: {
    userId: string;
    organizationId: string;
    userAgent?: string | null;
    ipHash?: string | null;
    db?: Database;
  },
): Promise<{ token: string; sessionId: string; absoluteExpiresAt: Date }> {
  const db = input.db ?? getDb();
  const token = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  const sessionId = createId("ses");
  await db.insert(sessions).values({
    id: sessionId,
    userId: input.userId,
    organizationId: input.organizationId,
    tokenHash: hashToken(token),
    userAgent: input.userAgent ?? null,
    ipHash: input.ipHash ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    absoluteExpiresAt,
  });
  return { token, sessionId, absoluteExpiresAt };
}

export async function validateSessionToken(
  token: string,
  db: Database = getDb(),
): Promise<SessionContext | null> {
  if (!token || token.length > 200) return null;
  const now = new Date();
  const rows = await db
    .select({
      session: sessions,
      user: users,
      membership: memberships,
      role: roles,
      organization: organizations,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, sessions.userId),
        eq(memberships.organizationId, sessions.organizationId),
      ),
    )
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .innerJoin(organizations, eq(organizations.id, sessions.organizationId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { session, user, membership, role, organization } = row;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= now.getTime()) return null;
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) return null;
  if (user.status !== "active") return null;
  if (membership.status !== "active") return null;
  if (organization.status !== "active") return null;
  if (!canUseWebAdmin(role.code)) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_WRITE_MS) {
    const nextExpiry = new Date(
      Math.min(now.getTime() + SESSION_IDLE_MS, session.absoluteExpiresAt.getTime()),
    );
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: nextExpiry })
      .where(eq(sessions.id, session.id));
  }

  const permissionRows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, membership.roleId));

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      lastLoginAt: user.lastLoginAt,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      currency: organization.currency,
    },
    membership: {
      id: membership.id,
      roleId: membership.roleId,
      roleCode: role.code,
      roleName: role.name,
      defaultBranchId: membership.defaultBranchId,
      status: membership.status,
    },
    permissions: permissionRows.map((p) => p.code),
  };
}

export function hasPermission(session: SessionContext, permission: string): boolean {
  return session.permissions.includes(permission);
}

export async function revokeSession(
  sessionId: string,
  reason: string,
  db: Database = getDb(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(
  userId: string,
  organizationId: string,
  reason: string,
  options: { exceptSessionId?: string; db?: Database } = {},
): Promise<number> {
  const db = options.db ?? getDb();
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.organizationId, organizationId),
        isNull(sessions.revokedAt),
      ),
    );
  const ids = rows.map((r) => r.id).filter((id) => id !== options.exceptSessionId);
  if (ids.length === 0) return 0;
  const now = new Date();
  for (const id of ids) {
    await db
      .update(sessions)
      .set({ revokedAt: now, revokedReason: reason })
      .where(eq(sessions.id, id));
  }
  return ids.length;
}

export async function revokeOtherSessions(
  userId: string,
  organizationId: string,
  currentSessionId: string,
  reason: string,
  db: Database = getDb(),
): Promise<number> {
  return revokeAllUserSessions(userId, organizationId, reason, {
    exceptSessionId: currentSessionId,
    db,
  });
}
