import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { revokeSession } from "@/lib/auth/session";
import { getMobileSession } from "@/lib/http/mobile-route";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  sessionFor,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

function mobileRequest(authorization?: string) {
  return new Request("http://localhost/api/mobile/auth/session", {
    headers: authorization ? { authorization } : {},
  });
}

describe("getMobileSession", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let organizationId: string;
  let branchId: string;
  let userId: string;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    const org = await seedOrganization(ctx.db);
    organizationId = org.organizationId;
    branchId = org.branchId;
    const user = await seedUser(ctx.db, {
      email: "cashier@demostore.id",
      name: "Rani",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId,
      branchId,
    });
    userId = user.userId;
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("returns the session for a valid bearer token", async () => {
    const { token } = await sessionFor(ctx.db, userId, organizationId);

    const session = await getMobileSession(mobileRequest(`Bearer ${token}`), ctx.db);

    expect(session?.user.id).toBe(userId);
    expect(session?.membership.roleCode).toBe("cashier");
  });

  it("returns null without an authorization header", async () => {
    expect(await getMobileSession(mobileRequest(), ctx.db)).toBeNull();
  });

  it("only accepts the Bearer scheme", async () => {
    const { token } = await sessionFor(ctx.db, userId, organizationId);

    expect(await getMobileSession(mobileRequest(`Basic ${token}`), ctx.db)).toBeNull();
    expect(await getMobileSession(mobileRequest(token), ctx.db)).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    expect(await getMobileSession(mobileRequest("Bearer not-a-real-token"), ctx.db)).toBeNull();
  });

  it("returns null for a revoked session", async () => {
    const { token, session } = await sessionFor(ctx.db, userId, organizationId);
    await revokeSession(session.sessionId, "test", ctx.db);

    expect(await getMobileSession(mobileRequest(`Bearer ${token}`), ctx.db)).toBeNull();
  });
});
