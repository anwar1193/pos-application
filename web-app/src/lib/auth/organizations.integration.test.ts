import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/lib/ids";
import { memberships } from "@/db/schema";
import {
  listUserOrganizations,
  switchOrganization,
} from "@/lib/auth/organizations";
import { validateSessionToken } from "@/lib/auth/session";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  sessionFor,
  TEST_META,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

describe("organization switching", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let userId: string;
  let primary: { organizationId: string; branchId: string };
  let secondary: { organizationId: string; branchId: string };

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    primary = await seedOrganization(ctx.db, "Toko Utama");
    secondary = await seedOrganization(ctx.db, "Toko Cabang");
    const user = await seedUser(ctx.db, {
      email: "multi@demostore.id",
      password: "MultiOrgPass2026!",
      roleId: rbac.roleIds.manager,
      organizationId: primary.organizationId,
      branchId: primary.branchId,
    });
    userId = user.userId;

    const now = new Date();
    await ctx.db.insert(memberships).values({
      id: createId("mem"),
      organizationId: secondary.organizationId,
      userId,
      roleId: rbac.roleIds.admin,
      defaultBranchId: secondary.branchId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("lists every organization the user can open", async () => {
    const organizations = await listUserOrganizations(userId, ctx.db);
    expect(organizations.map((org) => org.name).sort()).toEqual([
      "Toko Cabang",
      "Toko Utama",
    ]);
  });

  it("moves the browser session and revokes the old one", async () => {
    const { session, token } = await sessionFor(ctx.db, userId, primary.organizationId);

    const result = await switchOrganization(session, secondary.organizationId, TEST_META, ctx.db);
    expect(result.token).toBeTruthy();
    expect(result.redirectTo).toBe("/dashboard");

    const switched = await validateSessionToken(result.token!, ctx.db);
    expect(switched?.organization.id).toBe(secondary.organizationId);
    expect(switched?.membership.roleCode).toBe("admin");
    expect(await validateSessionToken(token, ctx.db)).toBeNull();
  });

  it("refuses an organization the user does not belong to", async () => {
    const { session } = await sessionFor(ctx.db, userId, primary.organizationId);
    const outsider = await seedOrganization(ctx.db, "Toko Lain");

    await expect(
      switchOrganization(session, outsider.organizationId, TEST_META, ctx.db),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the current session when switching to the same organization", async () => {
    const { session, token } = await sessionFor(ctx.db, userId, primary.organizationId);

    const result = await switchOrganization(session, primary.organizationId, TEST_META, ctx.db);
    expect(result.token).toBeNull();
    expect(await validateSessionToken(token, ctx.db)).not.toBeNull();
  });
});
