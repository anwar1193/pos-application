import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mobileLogin } from "@/lib/mobile/auth";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  TEST_META,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

describe("mobileLogin", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let organizationId: string;
  let branchId: string;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    const org = await seedOrganization(ctx.db);
    organizationId = org.organizationId;
    branchId = org.branchId;
    await seedUser(ctx.db, {
      email: "rani@demostore.id",
      name: "Rani",
      password: "demoKasir2026!",
      roleId: rbac.roleIds.cashier,
      organizationId,
      branchId,
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("authenticates a cashier and returns a bearer token", async () => {
    const result = await mobileLogin(
      {
        email: "rani@demostore.id",
        password: "demoKasir2026!",
        deviceName: "iPhone Rani",
        ...TEST_META,
      },
      ctx.db,
    );

    expect(result.token).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.session.user.email).toBe("rani@demostore.id");
    expect(result.session.membership.roleCode).toBe("cashier");
    expect(result.session.permissions).toContain("sale.create");
  });

  it("normalizes the email before authentication", async () => {
    const result = await mobileLogin(
      {
        email: "  Rani@DemoStore.ID ",
        password: "demoKasir2026!",
        ...TEST_META,
      },
      ctx.db,
    );

    expect(result.session.user.email).toBe("rani@demostore.id");
  });

  it("rejects a wrong password", async () => {
    await expect(
      mobileLogin(
        {
          email: "rani@demostore.id",
          password: "WrongPassword2026!",
          ...TEST_META,
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });
  });

  it("rejects a role that cannot use the mobile dashboard", async () => {
    await seedUser(ctx.db, {
      email: "gudang@demostore.id",
      name: "Gudang",
      password: "demoGudang2026!",
      roleId: rbac.roleIds.warehouse,
      organizationId,
      branchId,
    });

    await expect(
      mobileLogin(
        {
          email: "gudang@demostore.id",
          password: "demoGudang2026!",
          ...TEST_META,
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
