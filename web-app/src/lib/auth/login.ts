import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { writeAudit, writeAuditBestEffort } from "@/lib/audit/audit";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import {
  ACCOUNT_LOCK_THRESHOLD,
  isLockActive,
  isRateLimited,
  nextLockout,
  recordLoginAttempt,
} from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { createSession } from "@/lib/auth/session";
import { canUseWebAdmin, homePathFor } from "@/lib/auth/permissions";
import { hashEmail, normalizeEmail } from "@/lib/auth/tokens";
import { ERRORS } from "@/lib/http/errors";
import {
  memberships,
  organizations,
  roles,
  users,
} from "@/db/schema";

export type LoginResult = {
  token: string;
  sessionId: string;
  absoluteExpiresAt: Date;
  redirectTo: string;
};

export async function login(
  input: {
    email: string;
    password: string;
    next?: string;
    ipHash: string;
    userAgent: string;
    requestId: string;
  },
  db = getDb(),
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const emailHash = hashEmail(email);

  if (await isRateLimited({ emailHash, ipHash: input.ipHash }, db)) {
    throw ERRORS.rateLimited();
  }

  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];

  if (user && isLockActive(user.lockedUntil)) {
    throw ERRORS.accountLocked();
  }

  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const passwordValid = await verifyPassword(hashToCheck, input.password);

  if (!user || !user.passwordHash || !passwordValid) {
    await recordLoginAttempt({ emailHash, ipHash: input.ipHash, success: false }, db);
    if (user) {
      const attempts = user.failedLoginAttempts + 1;
      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          lockedUntil: nextLockout(attempts),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      const membership = (
        await db
          .select({ organizationId: memberships.organizationId })
          .from(memberships)
          .where(eq(memberships.userId, user.id))
          .limit(1)
      )[0];
      if (membership) {
        await writeAuditBestEffort(
          {
            organizationId: membership.organizationId,
            actorUserId: user.id,
            action: "auth.login.failed",
            entityType: "user",
            entityId: user.id,
            metadata: { requestId: input.requestId, reason: "invalid_credentials" },
            ipHash: input.ipHash,
            userAgent: input.userAgent,
          },
          db,
        );
      }
    }
    throw ERRORS.invalidCredentials();
  }

  if (user.status !== "active") {
    await recordLoginAttempt({ emailHash, ipHash: input.ipHash, success: false }, db);
    if (user.lockedUntil && isLockActive(user.lockedUntil)) {
      throw ERRORS.accountLocked();
    }
    throw ERRORS.accountInactive();
  }

  const membershipRow = (
    await db
      .select({
        membership: memberships,
        role: roles,
        organization: organizations,
      })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.status, "active"),
          eq(organizations.status, "active"),
          or(isNull(roles.organizationId), eq(roles.organizationId, memberships.organizationId)),
        ),
      )
      .limit(1)
  )[0];

  if (!membershipRow || !canUseWebAdmin(membershipRow.role.code)) {
    await recordLoginAttempt({ emailHash, ipHash: input.ipHash, success: false }, db);
    throw ERRORS.accountInactive();
  }

  const now = new Date();
  const session = await createSession({
    userId: user.id,
    organizationId: membershipRow.organization.id,
    userAgent: input.userAgent,
    ipHash: input.ipHash,
    db,
  });
  await recordLoginAttempt({ emailHash, ipHash: input.ipHash, success: true }, db);
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));
  await writeAudit(
    {
      organizationId: membershipRow.organization.id,
      actorUserId: user.id,
      action: "auth.login.success",
      entityType: "session",
      entityId: session.sessionId,
      metadata: { requestId: input.requestId },
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    },
    db,
  );

  return {
    token: session.token,
    sessionId: session.sessionId,
    absoluteExpiresAt: session.absoluteExpiresAt,
    redirectTo: safeNextPath(input.next, homePathFor(membershipRow.role.code)),
  };
}

export async function resetFailedAttempts(userId: string, db = getDb()): Promise<void> {
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export { ACCOUNT_LOCK_THRESHOLD };
