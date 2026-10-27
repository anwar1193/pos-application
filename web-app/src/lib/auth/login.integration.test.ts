import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditLogs, loginAttempts, sessions, users } from "@/db/schema";
import { login } from "@/lib/auth/login";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

const OWNER_EMAIL = "owner@demostore.id";
const OWNER_PASSWORD = "OwnerPass2026!";

describe("login", () => {
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
      email: OWNER_EMAIL,
      name: "Rani Wahyuni",
      password: OWNER_PASSWORD,
      roleId: rbac.roleIds.owner,
      organizationId,
      branchId,
    });
    ownerId = owner.userId;
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("creates a session and an audit entry on success", async () => {
    const result = await login(
      {
        email: "  Owner@DemoStore.ID ",
        password: OWNER_PASSWORD,
        ipHash: "ip-1",
        userAgent: "vitest",
        requestId: "req-success",
      },
      ctx.db,
    );

    expect(result.token).toBeTruthy();
    expect(result.sessionId).toMatch(/^ses_/);

    const sessionRows = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ownerId));
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0].tokenHash).not.toBe(result.token);

    const auditRows = await ctx.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.login.success"));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actorUserId).toBe(ownerId);
  });

  it("rejects a wrong password with a generic error and records the attempt", async () => {
    await expect(
      login(
        {
          email: OWNER_EMAIL,
          password: "WrongPassword2026!",
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-fail",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });

    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    const attempts = await ctx.db.select().from(loginAttempts);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].success).toBe(false);
  });

  it("does not reveal whether an unknown email exists", async () => {
    await expect(
      login(
        {
          email: "nobody@demostore.id",
          password: "SomePassword2026!",
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-unknown",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
  });

  it("rate limits repeated failures for the same email and IP", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        login(
          {
            email: OWNER_EMAIL,
            password: "WrongPassword2026!",
            ipHash: "ip-1",
            userAgent: "vitest",
            requestId: `req-${attempt}`,
          },
          ctx.db,
        ),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    }

    await expect(
      login(
        {
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-limited",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("locks the account after ten failures across IPs", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        login(
          {
            email: OWNER_EMAIL,
            password: "WrongPassword2026!",
            ipHash: `ip-${attempt}`,
            userAgent: "vitest",
            requestId: `req-${attempt}`,
          },
          ctx.db,
        ),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    }

    await expect(
      login(
        {
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          ipHash: "ip-fresh",
          userAgent: "vitest",
          requestId: "req-locked",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_ACCOUNT_LOCKED", status: 423 });
  });

  it("sends a cashier to the POS after a successful login", async () => {
    await seedUser(ctx.db, {
      email: "cashier@demostore.id",
      name: "Kasir Satu",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId,
      branchId,
    });

    const result = await login(
      {
        email: "cashier@demostore.id",
        password: "CashierPass2026!",
        ipHash: "ip-1",
        userAgent: "vitest",
        requestId: "req-cashier",
      },
      ctx.db,
    );

    expect(result.token).toBeTruthy();
    expect(result.redirectTo).toBe("/pos");
  });

  it("rejects a suspended user", async () => {
    await ctx.db
      .update(users)
      .set({ status: "suspended" })
      .where(eq(users.id, ownerId));

    await expect(
      login(
        {
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-suspended",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_ACCOUNT_INACTIVE" });
  });
});
