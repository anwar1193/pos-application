import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessions, users } from "@/db/schema";
import {
  createSession,
  revokeSession,
  validateSessionToken,
} from "@/lib/auth/session";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  sessionFor,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

describe("session validation", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let organizationId: string;
  let branchId: string;
  let ownerId: string;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    const org = await seedOrganization(ctx.db);
    organizationId = org.organizationId;
    branchId = org.branchId;
    const owner = await seedUser(ctx.db, {
      email: "owner@demostore.id",
      name: "Rani Wahyuni",
      password: "OwnerPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId,
      branchId,
    });
    ownerId = owner.userId;
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("returns the user, organization, role, and permissions for a valid token", async () => {
    const { session } = await sessionFor(ctx.db, ownerId, organizationId);

    expect(session.user.id).toBe(ownerId);
    expect(session.organization.id).toBe(organizationId);
    expect(session.membership.roleCode).toBe("owner");
    expect(session.permissions).toContain("user.invite");
  });

  it("rejects a revoked session", async () => {
    const { session, token } = await sessionFor(ctx.db, ownerId, organizationId);
    await revokeSession(session.sessionId, "test", ctx.db);

    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("rejects an idle-expired session", async () => {
    const { session, token } = await sessionFor(ctx.db, ownerId, organizationId);
    await ctx.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.sessionId));

    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("rejects an absolute-expired session", async () => {
    const { session, token } = await sessionFor(ctx.db, ownerId, organizationId);
    await ctx.db
      .update(sessions)
      .set({ absoluteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.sessionId));

    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("rejects the session of a suspended user", async () => {
    const { token } = await sessionFor(ctx.db, ownerId, organizationId);
    await ctx.db.update(users).set({ status: "suspended" }).where(eq(users.id, ownerId));

    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("rejects sessions for roles that may not use web admin", async () => {
    const cashier = await seedUser(ctx.db, {
      email: "cashier@demostore.id",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId,
      branchId,
    });
    const { token } = await createSession({
      userId: cashier.userId,
      organizationId,
      db: ctx.db,
    });

    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("rejects an unknown token", async () => {
    expect(await validateSessionToken("not-a-real-token", ctx.db)).toBeNull();
  });
});
