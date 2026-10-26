import { and, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import {
  branches,
  memberships,
  organizations,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@/db/schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const db = getDb();
  const now = new Date();
  const ownerEmail = requireEnv("SEED_OWNER_EMAIL").trim().toLowerCase();
  const ownerPassword = requireEnv("SEED_OWNER_PASSWORD");
  if (ownerPassword.length < 12) {
    throw new Error("SEED_OWNER_PASSWORD must be at least 12 characters.");
  }
  const organizationName = process.env.SEED_ORGANIZATION_NAME ?? "Demo Store";
  const branchName = process.env.SEED_BRANCH_NAME ?? "Main Branch";

  const permissionRows = Object.entries(PERMISSION_DESCRIPTIONS).map(([code, description]) => ({
    id: `perm_${code.replaceAll(".", "_")}`,
    code,
    description,
  }));
  for (const permission of permissionRows) {
    await db
      .insert(permissions)
      .values(permission)
      .onConflictDoUpdate({
        target: permissions.code,
        set: { description: permission.description },
      });
  }

  const roleIds: Partial<Record<RoleCode, string>> = {};
  for (const code of Object.values(ROLE_CODES)) {
    const existing = await db
      .select()
      .from(roles)
      .where(and(eq(roles.code, code), eq(roles.isSystem, true)))
      .limit(1);
    if (existing[0]) {
      roleIds[code] = existing[0].id;
    } else {
      const roleId = createId("role");
      await db.insert(roles).values({
        id: roleId,
        organizationId: null,
        code,
        name: ROLE_NAMES[code],
        isSystem: true,
        createdAt: now,
      });
      roleIds[code] = roleId;
    }
  }

  for (const [code, granted] of Object.entries(ROLE_PERMISSIONS) as [RoleCode, Permission[]][]) {
    for (const permissionCode of granted) {
      const permission = permissionRows.find((p) => p.code === permissionCode);
      if (!permission) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: roleIds[code]!, permissionId: permission.id })
        .onConflictDoNothing();
    }
  }

  let organization = (
    await db.select().from(organizations).where(eq(organizations.slug, "demo-store")).limit(1)
  )[0];
  if (!organization) {
    organization = {
      id: createId("org"),
      name: organizationName,
      slug: "demo-store",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(organizations).values(organization);
  }

  let branch = (
    await db
      .select()
      .from(branches)
      .where(and(eq(branches.organizationId, organization.id), eq(branches.code, "MAIN")))
      .limit(1)
  )[0];
  if (!branch) {
    branch = {
      id: createId("br"),
      organizationId: organization.id,
      name: branchName,
      code: "MAIN",
      phone: null,
      address: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(branches).values(branch);
  }

  let owner = (await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
  if (!owner) {
    owner = {
      id: createId("usr"),
      email: ownerEmail,
      name: "Rani Wahyuni",
      phone: null,
      passwordHash: await hashPassword(ownerPassword),
      status: "active",
      emailVerifiedAt: now,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(users).values(owner);
  }

  const membership = (
    await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organization.id),
          eq(memberships.userId, owner.id),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) {
    await db.insert(memberships).values({
      id: createId("mem"),
      organizationId: organization.id,
      userId: owner.id,
      roleId: roleIds[ROLE_CODES.owner]!,
      defaultBranchId: branch.id,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(
    `Seed complete: ${organization.name} / ${branch.name} / owner ${ownerEmail}. Use SEED_OWNER_PASSWORD to sign in.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
