import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { invitations, memberships, sessions, users } from "@/db/schema";
import { login } from "@/lib/auth/login";
import { validateSessionToken } from "@/lib/auth/session";
import {
  acceptInvitation,
  createPasswordResetLink,
  deactivateUser,
  getUserDetail,
  inviteUser,
  listUsers,
  reactivateUser,
  resetPasswordWithToken,
  revokeInvitation,
  revokeUserSessions,
  updateUser,
} from "@/lib/users/service";
import type { SessionContext } from "@/lib/auth/session";
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

function tokenFromUrl(url: string, segment: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  return parts[index + 1];
}

describe("user management service", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let owner: { userId: string; session: SessionContext };
  let admin: { userId: string; session: SessionContext };

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    org = await seedOrganization(ctx.db);

    const ownerRow = await seedUser(ctx.db, {
      email: "owner@demostore.id",
      name: "Rani Wahyuni",
      password: "OwnerPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    owner = {
      userId: ownerRow.userId,
      session: (await sessionFor(ctx.db, ownerRow.userId, org.organizationId)).session,
    };

    const adminRow = await seedUser(ctx.db, {
      email: "admin@demostore.id",
      name: "Admin Toko",
      password: "AdminPass2026!",
      roleId: rbac.roleIds.admin,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    admin = {
      userId: adminRow.userId,
      session: (await sessionFor(ctx.db, adminRow.userId, org.organizationId)).session,
    };
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("lists only users from the caller's organization and never returns password hashes", async () => {
    const otherOrg = await seedOrganization(ctx.db, "Other Store");
    await seedUser(ctx.db, {
      email: "outsider@other.id",
      password: "OutsiderPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: otherOrg.organizationId,
      branchId: otherOrg.branchId,
    });

    const result = await listUsers(owner.session, {}, ctx.db);

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.email).sort()).toEqual([
      "admin@demostore.id",
      "owner@demostore.id",
    ]);
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(JSON.stringify(result)).not.toContain("$argon2");
  });

  it("refuses to read a user from another organization (IDOR)", async () => {
    const otherOrg = await seedOrganization(ctx.db, "Other Store");
    const outsider = await seedUser(ctx.db, {
      email: "outsider@other.id",
      password: "OutsiderPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: otherOrg.organizationId,
      branchId: otherOrg.branchId,
    });

    await expect(getUserDetail(owner.session, outsider.userId, ctx.db)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("creates a one-time invitation that activates the account on acceptance", async () => {
    const invitation = await inviteUser(
      owner.session,
      {
        name: "Admin Baru",
        email: "new-admin@demostore.id",
        roleId: rbac.roleIds.admin,
        branchId: org.branchId,
      },
      TEST_META,
      ctx.db,
    );
    const token = tokenFromUrl(invitation.inviteUrl, "invite");

    await acceptInvitation(token, "NewAdminPass2026!", TEST_META, ctx.db);

    const invitedUser = (
      await ctx.db.select().from(users).where(eq(users.email, "new-admin@demostore.id"))
    )[0];
    expect(invitedUser.status).toBe("active");

    const membership = (
      await ctx.db.select().from(memberships).where(eq(memberships.userId, invitedUser.id))
    )[0];
    expect(membership.status).toBe("active");

    const result = await login(
      {
        email: "new-admin@demostore.id",
        password: "NewAdminPass2026!",
        ipHash: "ip-1",
        userAgent: "vitest",
        requestId: "req-invited-login",
      },
      ctx.db,
    );
    expect(result.token).toBeTruthy();

    await expect(
      acceptInvitation(token, "AnotherPass2026!", TEST_META, ctx.db),
    ).rejects.toMatchObject({ code: "INVITATION_EXPIRED" });
  });

  it("revoking an invitation only suspends the invited membership", async () => {
    const invitation = await inviteUser(
      owner.session,
      {
        name: "Undangan Dicabut",
        email: "revoked@demostore.id",
        roleId: rbac.roleIds.cashier,
        branchId: org.branchId,
      },
      TEST_META,
      ctx.db,
    );

    await revokeInvitation(owner.session, invitation.invitationId, TEST_META, ctx.db);

    const ownerMembership = (
      await ctx.db.select().from(memberships).where(eq(memberships.userId, owner.userId))
    )[0];
    const adminMembership = (
      await ctx.db.select().from(memberships).where(eq(memberships.userId, admin.userId))
    )[0];
    expect(ownerMembership.status).toBe("active");
    expect(adminMembership.status).toBe("active");

    const invitedUser = (
      await ctx.db.select().from(users).where(eq(users.email, "revoked@demostore.id"))
    )[0];
    const invitedMembership = (
      await ctx.db.select().from(memberships).where(eq(memberships.userId, invitedUser.id))
    )[0];
    expect(invitedMembership.status).toBe("suspended");

    const storedInvitation = (
      await ctx.db.select().from(invitations).where(eq(invitations.id, invitation.invitationId))
    )[0];
    expect(storedInvitation.status).toBe("revoked");
  });

  it("prevents an admin from inviting another admin", async () => {
    await expect(
      inviteUser(
        admin.session,
        {
          name: "Second Admin",
          email: "second-admin@demostore.id",
          roleId: rbac.roleIds.admin,
          branchId: org.branchId,
        },
        TEST_META,
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents an admin from deactivating the owner", async () => {
    await expect(
      deactivateUser(admin.session, owner.userId, TEST_META, ctx.db),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents users from deactivating themselves", async () => {
    await expect(
      deactivateUser(owner.session, owner.userId, TEST_META, ctx.db),
    ).rejects.toMatchObject({ code: "SELF_DEACTIVATION_FORBIDDEN" });
  });

  it("revokes existing sessions when a user's role changes", async () => {
    const { token: adminToken } = await sessionFor(
      ctx.db,
      admin.userId,
      org.organizationId,
    );

    await updateUser(
      owner.session,
      admin.userId,
      { roleId: rbac.roleIds.manager },
      TEST_META,
      ctx.db,
    );

    expect(await validateSessionToken(adminToken, ctx.db)).toBeNull();

    const row = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, admin.userId));
    expect(row.every((session) => session.revokedReason === "role_changed")).toBe(true);
  });

  it("revokes sessions and rejects the old password after a reset", async () => {
    const { token: adminToken } = await sessionFor(
      ctx.db,
      admin.userId,
      org.organizationId,
    );

    const reset = await createPasswordResetLink(owner.session, admin.userId, TEST_META, ctx.db);
    const token = tokenFromUrl(reset.resetUrl, "reset-password");

    await resetPasswordWithToken(token, "ResetAdminPass2026!", TEST_META, ctx.db);

    expect(await validateSessionToken(adminToken, ctx.db)).toBeNull();

    await expect(
      login(
        {
          email: "admin@demostore.id",
          password: "AdminPass2026!",
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-old-password",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });

    const result = await login(
      {
        email: "admin@demostore.id",
        password: "ResetAdminPass2026!",
        ipHash: "ip-1",
        userAgent: "vitest",
        requestId: "req-new-password",
      },
      ctx.db,
    );
    expect(result.token).toBeTruthy();
  });

  it("revokes sessions on deactivation and allows reactivation", async () => {
    const { token: adminToken } = await sessionFor(
      ctx.db,
      admin.userId,
      org.organizationId,
    );

    await deactivateUser(owner.session, admin.userId, TEST_META, ctx.db);
    expect(await validateSessionToken(adminToken, ctx.db)).toBeNull();

    await expect(
      login(
        {
          email: "admin@demostore.id",
          password: "AdminPass2026!",
          ipHash: "ip-1",
          userAgent: "vitest",
          requestId: "req-deactivated",
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "AUTH_ACCOUNT_INACTIVE" });

    await reactivateUser(owner.session, admin.userId, TEST_META, ctx.db);

    const result = await login(
      {
        email: "admin@demostore.id",
        password: "AdminPass2026!",
        ipHash: "ip-1",
        userAgent: "vitest",
        requestId: "req-reactivated",
      },
      ctx.db,
    );
    expect(result.token).toBeTruthy();
  });

  it("revokes all target sessions on admin request", async () => {
    await sessionFor(ctx.db, admin.userId, org.organizationId);
    await sessionFor(ctx.db, admin.userId, org.organizationId);

    const result = await revokeUserSessions(
      owner.session,
      admin.userId,
      TEST_META,
      ctx.db,
    );

    expect(result.revoked).toBeGreaterThanOrEqual(3);

    const active = (
      await ctx.db.select().from(sessions).where(eq(sessions.userId, admin.userId))
    ).filter((session) => session.revokedAt === null);
    expect(active).toHaveLength(0);
  });
});
