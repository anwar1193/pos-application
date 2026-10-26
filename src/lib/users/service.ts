import { and, asc, count, desc, eq, inArray, isNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { writeAudit, writeAuditBestEffort } from "@/lib/audit/audit";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import {
  ACCOUNT_LOCK_THRESHOLD,
  isLockActive,
  isRateLimited,
  nextLockout,
  recordLoginAttempt,
} from "@/lib/auth/rate-limit";
import { requireApiPermission } from "@/lib/auth/guard";
import {
  createSession,
  revokeAllUserSessions,
  revokeSession,
  type SessionContext,
} from "@/lib/auth/session";
import { hashEmail, normalizeEmail } from "@/lib/auth/tokens";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import type { InviteUserInput, UpdateUserInput, UserListQuery } from "@/lib/validation/schemas";
import {
  auditLogs,
  branches,
  invitations,
  memberBranches,
  memberships,
  organizations,
  passwordResetTokens,
  permissions,
  rolePermissions,
  roles,
  sessions,
  users,
} from "@/db/schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Tx;

function activeSession() {
  return and(isNull(sessions.revokedAt), sql`${sessions.expiresAt} > ${Date.now()}`);
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function managerCanSee(branchIds: string[]): boolean {
  return branchIds.length > 0;
}

async function getManagerBranchIds(session: SessionContext, db: Executor): Promise<string[]> {
  if (session.membership.roleCode !== "manager") return [];
  const rows = await db
    .select({ branchId: memberBranches.branchId })
    .from(memberBranches)
    .where(eq(memberBranches.membershipId, session.membership.id));
  const ids = new Set(rows.map((r) => r.branchId));
  if (session.membership.defaultBranchId) ids.add(session.membership.defaultBranchId);
  return [...ids];
}

async function findTargetMembership(
  session: SessionContext,
  userId: string,
  db: Database,
) {
  const row = (
    await db
      .select({
        membership: memberships,
        user: users,
        role: roles,
        branch: branches,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .leftJoin(branches, eq(branches.id, memberships.defaultBranchId))
      .where(
        and(
          eq(memberships.organizationId, session.organization.id),
          eq(memberships.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  if (!row) throw ERRORS.notFound("User tidak ditemukan.");
  if (session.membership.roleCode === "manager") {
    const branchIds = await getManagerBranchIds(session, db);
    if (!row.membership.defaultBranchId || !branchIds.includes(row.membership.defaultBranchId)) {
      throw ERRORS.notFound("User tidak ditemukan.");
    }
  }
  return row;
}

function assertCanManageOwner(actorRole: string, targetRole: string): void {
  if (targetRole === "owner" && actorRole !== "owner") {
    throw ERRORS.forbidden("Admin tidak dapat mengubah Owner.");
  }
}

async function countActiveOwners(organizationId: string, db: Executor): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, "active"),
        eq(roles.code, "owner"),
      ),
    );
  return rows[0]?.value ?? 0;
}

async function getRoleInOrganization(roleId: string, organizationId: string, db: Executor) {
  const role = (
    await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          or(isNull(roles.organizationId), eq(roles.organizationId, organizationId)),
        ),
      )
      .limit(1)
  )[0];
  if (!role) throw ERRORS.validation({ roleId: "Role tidak valid." });
  return role;
}

async function getBranchInOrganization(branchId: string, organizationId: string, db: Executor) {
  const branch = (
    await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!branch) throw ERRORS.validation({ branchId: "Cabang tidak valid." });
  return branch;
}

export async function listUsers(
  session: SessionContext,
  query: UserListQuery,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userView);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const conditions: SQL[] = [eq(memberships.organizationId, session.organization.id)];

  if (query.q) {
    conditions.push(
      or(
        like(users.name, `%${query.q}%`),
        like(users.email, `%${query.q.toLowerCase()}%`),
      )!,
    );
  }
  if (query.role) conditions.push(eq(roles.id, query.role));
  if (query.status) conditions.push(eq(memberships.status, query.status));
  if (query.branch) conditions.push(eq(memberships.defaultBranchId, query.branch));

  if (session.membership.roleCode === "manager") {
    const branchIds = await getManagerBranchIds(session, db);
    if (!managerCanSee(branchIds)) {
      return { items: [], total: 0, page, pageSize };
    }
    conditions.push(inArray(memberships.defaultBranchId, branchIds));
  }

  const where = and(...conditions);
  const sortColumn = {
    name: users.name,
    role: roles.name,
    status: memberships.status,
    lastLogin: users.lastLoginAt,
  }[query.sort ?? "name"];
  const order = query.order === "desc" ? desc(sortColumn) : asc(sortColumn);

  const rows = await db
    .select({
      id: users.id,
      membershipId: memberships.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      userStatus: users.status,
      status: memberships.status,
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name,
      branchId: branches.id,
      branchName: branches.name,
      lastLoginAt: users.lastLoginAt,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .leftJoin(branches, eq(branches.id, memberships.defaultBranchId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRows = await db
    .select({ value: count() })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(where);

  return {
    items: rows.map((row) => ({
      id: row.id,
      membershipId: row.membershipId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      userStatus: row.userStatus,
      role: { id: row.roleId, code: row.roleCode, name: row.roleName },
      branch: row.branchId ? { id: row.branchId, name: row.branchName } : null,
      lastLoginAt: row.lastLoginAt,
      joinedAt: row.joinedAt,
    })),
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize,
  };
}

export async function getUserDetail(
  session: SessionContext,
  userId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userView);
  const target = await findTargetMembership(session, userId, db);
  const sessionRows = await db
    .select({ value: count() })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.organizationId, session.organization.id),
        activeSession(),
      ),
    );
  const activity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, session.organization.id),
        or(eq(auditLogs.actorUserId, userId), eq(auditLogs.entityId, userId)),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const pendingInvitation = (
    await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, session.organization.id),
          eq(invitations.email, target.user.email),
          eq(invitations.status, "pending"),
          sql`${invitations.expiresAt} > ${Date.now()}`,
        ),
      )
      .limit(1)
  )[0];

  return {
    id: target.user.id,
    name: target.user.name,
    email: target.user.email,
    phone: target.user.phone,
    status: target.membership.status,
    userStatus: target.user.status,
    role: { id: target.role.id, code: target.role.code, name: target.role.name },
    branch: target.branch ? { id: target.branch.id, name: target.branch.name } : null,
    joinedAt: target.membership.createdAt,
    lastLoginAt: target.user.lastLoginAt,
    activeSessions: sessionRows[0]?.value ?? 0,
    pendingInvitationId: pendingInvitation?.id ?? null,
    recentActivity: activity,
  };
}

export async function inviteUser(
  session: SessionContext,
  input: InviteUserInput,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userInvite);
  const email = normalizeEmail(input.email);
  const role = await getRoleInOrganization(input.roleId, session.organization.id, db);

  if (session.membership.roleCode !== "owner" && ["owner", "admin"].includes(role.code)) {
    throw ERRORS.forbidden("Hanya Owner yang dapat memberikan role Owner atau Admin.");
  }
  if (input.branchId) {
    await getBranchInOrganization(input.branchId, session.organization.id, db);
  }

  let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (user) {
    const existingMembership = (
      await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, session.organization.id),
            eq(memberships.userId, user.id),
          ),
        )
        .limit(1)
    )[0];
    if (existingMembership) throw ERRORS.userEmailExists();
  }

  const pending = (
    await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, session.organization.id),
          eq(invitations.email, email),
          eq(invitations.status, "pending"),
          sql`${invitations.expiresAt} > ${Date.now()}`,
        ),
      )
      .limit(1)
  )[0];
  if (pending) throw ERRORS.conflict("Sudah ada undangan tertunda untuk email ini.");

  if (user && user.status === "suspended") {
    throw ERRORS.conflict("Akun dengan email ini sedang dinonaktifkan.");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const invitationId = createId("inv");
  const membershipId = createId("mem");

  await db.transaction(async (tx) => {
    if (!user) {
      user = {
        id: createId("usr"),
        email,
        name: input.name,
        phone: null,
        passwordHash: null,
        status: "invited",
        emailVerifiedAt: null,
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(users).values(user);
    }
    await tx.insert(memberships).values({
      id: membershipId,
      organizationId: session.organization.id,
      userId: user.id,
      roleId: role.id,
      defaultBranchId: input.branchId ?? null,
      status: "invited",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(invitations).values({
      id: invitationId,
      organizationId: session.organization.id,
      email,
      name: input.name,
      roleId: role.id,
      branchId: input.branchId ?? null,
      tokenHash,
      invitedBy: session.user.id,
      status: "pending",
      expiresAt,
      createdAt: now,
    });
    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "user.invited",
        entityType: "user",
        entityId: user!.id,
        branchId: input.branchId ?? null,
        afterData: { email, role: role.code, membershipId },
        metadata: { invitationId, requestId: meta.requestId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });

  return {
    invitationId,
    inviteUrl: `${appUrl()}/invite/${token}`,
    expiresAt,
  };
}

export async function updateUser(
  session: SessionContext,
  userId: string,
  input: UpdateUserInput,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userUpdate);
  const target = await findTargetMembership(session, userId, db);
  const actorRole = session.membership.roleCode;
  assertCanManageOwner(actorRole, target.role.code);
  let newRoleCode = target.role.code;

  if (input.roleId && input.roleId !== target.role.id) {
    if (userId === session.user.id) throw ERRORS.forbidden("Anda tidak dapat mengubah role sendiri.");
    if (actorRole !== "owner" && ["owner", "admin"].includes(target.role.code)) {
      throw ERRORS.forbidden("Admin tidak dapat mengubah role Owner atau Admin.");
    }
    const newRole = await getRoleInOrganization(input.roleId, session.organization.id, db);
    newRoleCode = newRole.code;
    if (actorRole !== "owner" && ["owner", "admin"].includes(newRole.code)) {
      throw ERRORS.forbidden("Hanya Owner yang dapat memberikan role Owner atau Admin.");
    }
    if (target.role.code === "owner" && newRole.code !== "owner") {
      if ((await countActiveOwners(session.organization.id, db)) <= 1) throw ERRORS.lastOwner();
    }
  }

  if (input.defaultBranchId) {
    await getBranchInOrganization(input.defaultBranchId, session.organization.id, db);
  }

  const roleChanged = Boolean(input.roleId && input.roleId !== target.role.id);
  const now = new Date();
  await db.transaction(async (tx) => {
    const userPatch: Record<string, unknown> = { updatedAt: now };
    if (input.name !== undefined) userPatch.name = input.name;
    if (input.phone !== undefined) userPatch.phone = input.phone || null;
    if (Object.keys(userPatch).length > 1) {
      await tx.update(users).set(userPatch).where(eq(users.id, userId));
    }

    const membershipPatch: Record<string, unknown> = { updatedAt: now };
    if (input.roleId) membershipPatch.roleId = input.roleId;
    if (input.defaultBranchId !== undefined) membershipPatch.defaultBranchId = input.defaultBranchId;
    await tx.update(memberships).set(membershipPatch).where(eq(memberships.id, target.membership.id));

    if (roleChanged) {
      await tx
        .update(sessions)
        .set({ revokedAt: now, revokedReason: "role_changed" })
        .where(
          and(
            eq(sessions.userId, userId),
            eq(sessions.organizationId, session.organization.id),
            isNull(sessions.revokedAt),
          ),
        );
    }

    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: roleChanged ? "user.role_changed" : "user.updated",
        entityType: "user",
        entityId: userId,
        branchId: input.defaultBranchId ?? target.membership.defaultBranchId,
        beforeData: {
          name: target.user.name,
          phone: target.user.phone,
          role: target.role.code,
          branchId: target.membership.defaultBranchId,
        },
        afterData: {
          name: input.name ?? target.user.name,
          phone: input.phone !== undefined ? input.phone : target.user.phone,
          role: newRoleCode,
          branchId: input.defaultBranchId ?? target.membership.defaultBranchId,
        },
        metadata: { requestId: meta.requestId, sessionsRevoked: roleChanged },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });

  return getUserDetail(session, userId, db);
}

export async function deactivateUser(
  session: SessionContext,
  userId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userDeactivate);
  if (userId === session.user.id) throw ERRORS.selfDeactivation();
  const target = await findTargetMembership(session, userId, db);
  assertCanManageOwner(session.membership.roleCode, target.role.code);
  if (target.role.code === "owner" && (await countActiveOwners(session.organization.id, db)) <= 1) {
    throw ERRORS.lastOwner();
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ status: "suspended", updatedAt: now })
      .where(eq(memberships.id, target.membership.id));

    const otherActive = await tx
      .select({ value: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
          ne(memberships.id, target.membership.id),
        ),
      );
    if ((otherActive[0]?.value ?? 0) === 0) {
      await tx
        .update(users)
        .set({ status: "suspended", updatedAt: now })
        .where(eq(users.id, userId));
    }

    await tx
      .update(sessions)
      .set({ revokedAt: now, revokedReason: "user_deactivated" })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.organizationId, session.organization.id),
          isNull(sessions.revokedAt),
        ),
      );

    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "user.deactivated",
        entityType: "user",
        entityId: userId,
        beforeData: { status: target.membership.status },
        afterData: { status: "suspended" },
        metadata: { requestId: meta.requestId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });

  return { ok: true };
}

export async function reactivateUser(
  session: SessionContext,
  userId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userDeactivate);
  const target = await findTargetMembership(session, userId, db);
  assertCanManageOwner(session.membership.roleCode, target.role.code);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ status: "active", updatedAt: now })
      .where(eq(memberships.id, target.membership.id));
    await tx.update(users).set({ status: "active", updatedAt: now }).where(eq(users.id, userId));
    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "user.reactivated",
        entityType: "user",
        entityId: userId,
        beforeData: { status: target.membership.status },
        afterData: { status: "active" },
        metadata: { requestId: meta.requestId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });
  return { ok: true };
}

export async function createPasswordResetLink(
  session: SessionContext,
  userId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userResetPassword);
  const target = await findTargetMembership(session, userId, db);
  assertCanManageOwner(session.membership.roleCode, target.role.code);

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const tokenId = createId("prt");

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      id: tokenId,
      userId,
      tokenHash,
      createdBy: session.user.id,
      expiresAt,
      createdAt: now,
    });
    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "user.password_reset_requested",
        entityType: "user",
        entityId: userId,
        metadata: { requestId: meta.requestId, resetTokenId: tokenId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });

  return { resetUrl: `${appUrl()}/reset-password/${token}`, expiresAt };
}

export async function revokeUserSessions(
  session: SessionContext,
  userId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.sessionRevoke);
  const target = await findTargetMembership(session, userId, db);
  assertCanManageOwner(session.membership.roleCode, target.role.code);
  const revoked = await revokeAllUserSessions(
    userId,
    session.organization.id,
    "admin_revoked",
    { db },
  );
  await writeAuditBestEffort(
    {
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      action: "session.revoked",
      entityType: "user",
      entityId: userId,
      metadata: { requestId: meta.requestId, revoked },
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
    db,
  );
  return { revoked };
}

export async function revokeInvitation(
  session: SessionContext,
  invitationId: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.userInvite);
  const invitation = (
    await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, session.organization.id),
        ),
      )
      .limit(1)
  )[0];
  if (!invitation) throw ERRORS.notFound("Undangan tidak ditemukan.");
  if (invitation.status !== "pending") throw ERRORS.conflict("Undangan sudah tidak aktif.");

  // Invitations store an email, not a user id. Resolve it first: an unqualified
  // column inside a raw subquery binds to the outer table, which would match
  // every membership in the organization.
  const invitedUser = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1)
  )[0];

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ status: "revoked" })
      .where(eq(invitations.id, invitationId));
    if (invitedUser) {
      await tx
        .update(memberships)
        .set({ status: "suspended", updatedAt: now })
        .where(
          and(
            eq(memberships.organizationId, session.organization.id),
            eq(memberships.userId, invitedUser.id),
          ),
        );
    }
    await writeAudit(
      {
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "invitation.revoked",
        entityType: "invitation",
        entityId: invitationId,
        metadata: { requestId: meta.requestId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });
  return { ok: true };
}

export async function getInvitationForToken(token: string, db: Database = getDb()) {
  const row = (
    await db
      .select({ invitation: invitations, organizationName: organizations.name })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(eq(invitations.tokenHash, hashToken(token)))
      .limit(1)
  )[0];
  if (!row) return null;
  return {
    id: row.invitation.id,
    email: row.invitation.email,
    name: row.invitation.name,
    status: row.invitation.status,
    expiresAt: row.invitation.expiresAt,
    organizationName: row.organizationName,
  };
}

export async function acceptInvitation(
  token: string,
  password: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  const row = (
    await db
      .select({ invitation: invitations, organizationName: organizations.name })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(eq(invitations.tokenHash, hashToken(token)))
      .limit(1)
  )[0];
  if (!row || row.invitation.status !== "pending") throw ERRORS.invitationExpired();
  if (row.invitation.expiresAt.getTime() <= Date.now()) {
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(eq(invitations.id, row.invitation.id));
    throw ERRORS.invitationExpired();
  }

  const user = (
    await db.select().from(users).where(eq(users.email, row.invitation.email)).limit(1)
  )[0];
  if (!user) throw ERRORS.invitationExpired();

  const policyError = validatePasswordPolicy(password, { email: user.email, name: user.name });
  if (policyError) throw ERRORS.validation({ password: policyError });

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        status: "active",
        emailVerifiedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await tx
      .update(memberships)
      .set({ status: "active", updatedAt: now })
      .where(
        and(
          eq(memberships.organizationId, row.invitation.organizationId),
          eq(memberships.userId, user.id),
        ),
      );
    await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(invitations.id, row.invitation.id));
    await writeAudit(
      {
        organizationId: row.invitation.organizationId,
        actorUserId: user.id,
        action: "user.invitation_accepted",
        entityType: "user",
        entityId: user.id,
        metadata: { invitationId: row.invitation.id, requestId: meta.requestId },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
      tx as unknown as Database,
    );
  });

  return { email: user.email, organizationName: row.organizationName };
}

export async function getResetTokenInfo(token: string, db: Database = getDb()) {
  const row = (
    await db
      .select({ token: passwordResetTokens, user: users })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
      .limit(1)
  )[0];
  if (!row || row.token.usedAt || row.token.expiresAt.getTime() <= Date.now()) return null;
  return { email: row.user.email, name: row.user.name, userId: row.user.id };
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  const row = (
    await db
      .select({ token: passwordResetTokens, user: users })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
      .limit(1)
  )[0];
  if (!row || row.token.usedAt || row.token.expiresAt.getTime() <= Date.now()) {
    throw ERRORS.invitationExpired();
  }
  const policyError = validatePasswordPolicy(password, {
    email: row.user.email,
    name: row.user.name,
  });
  if (policyError) throw ERRORS.validation({ password: policyError });

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const membership = (
    await db
      .select({ organizationId: memberships.organizationId })
      .from(memberships)
      .where(eq(memberships.userId, row.user.id))
      .limit(1)
  )[0];

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: now })
      .where(eq(users.id, row.user.id));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, row.token.id));
    await tx
      .update(sessions)
      .set({ revokedAt: now, revokedReason: "password_reset" })
      .where(and(eq(sessions.userId, row.user.id), isNull(sessions.revokedAt)));
    if (membership) {
      await writeAudit(
        {
          organizationId: membership.organizationId,
          actorUserId: row.user.id,
          action: "user.password_changed",
          entityType: "user",
          entityId: row.user.id,
          metadata: { requestId: meta.requestId, via: "reset_link" },
          ipHash: meta.ipHash,
          userAgent: meta.userAgent,
        },
        tx as unknown as Database,
      );
    }
  });

  return { email: row.user.email };
}

export async function changeOwnPassword(
  session: SessionContext,
  currentPassword: string,
  newPassword: string,
  meta: { ipHash?: string | null; userAgent?: string | null; requestId: string },
  db: Database = getDb(),
) {
  const user = (await db.select().from(users).where(eq(users.id, session.user.id)).limit(1))[0];
  if (!user?.passwordHash) throw ERRORS.authRequired();
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw ERRORS.validation({ currentPassword: "Password lama tidak sesuai." });
  }
  const policyError = validatePasswordPolicy(newPassword, { email: user.email, name: user.name });
  if (policyError) throw ERRORS.validation({ newPassword: policyError });

  const passwordHash = await hashPassword(newPassword);
  const newSession = await createSession({
    userId: user.id,
    organizationId: session.organization.id,
    userAgent: meta.userAgent,
    ipHash: meta.ipHash,
    db,
  });
  const now = new Date();
  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, user.id));
  await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: "password_changed" })
    .where(
      and(
        eq(sessions.userId, user.id),
        eq(sessions.organizationId, session.organization.id),
        isNull(sessions.revokedAt),
        ne(sessions.id, newSession.sessionId),
      ),
    );
  await revokeSession(session.sessionId, "password_changed", db);
  await writeAuditBestEffort(
    {
      organizationId: session.organization.id,
      actorUserId: user.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: user.id,
      metadata: { requestId: meta.requestId, via: "self" },
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
    db,
  );

  return {
    token: newSession.token,
    absoluteExpiresAt: newSession.absoluteExpiresAt,
    sessionId: newSession.sessionId,
  };
}

export async function listRoles(session: SessionContext, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.userView);
  return db
    .select({ id: roles.id, code: roles.code, name: roles.name })
    .from(roles)
    .where(
      and(
        or(isNull(roles.organizationId), eq(roles.organizationId, session.organization.id)),
        eq(roles.isSystem, true),
      ),
    )
    .orderBy(asc(roles.name));
}

export async function listBranches(session: SessionContext, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.userView);
  const rows = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(
      and(eq(branches.organizationId, session.organization.id), eq(branches.isActive, true)),
    )
    .orderBy(asc(branches.name));
  if (session.membership.roleCode !== "manager") return rows;
  const branchIds = await getManagerBranchIds(session, db);
  return rows.filter((row) => branchIds.includes(row.id));
}

export async function getMyPermissions(session: SessionContext, db: Database = getDb()) {
  return db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, session.membership.roleId));
}

export { ACCOUNT_LOCK_THRESHOLD, isLockActive, isRateLimited, nextLockout, recordLoginAttempt, hashEmail };
