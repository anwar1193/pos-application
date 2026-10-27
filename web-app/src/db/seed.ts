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
  categories,
  memberships,
  organizations,
  paymentMethods,
  permissions,
  rolePermissions,
  roles,
  units,
  users,
} from "@/db/schema";

const DEFAULT_PAYMENT_METHODS = [
  { code: "cash", name: "Tunai", sortOrder: 1 },
  { code: "card", name: "Kartu Debit/Kredit", sortOrder: 2 },
  { code: "transfer", name: "Transfer Bank", sortOrder: 3 },
  { code: "qr", name: "QRIS", sortOrder: 4 },
  { code: "manual", name: "Pembayaran Manual", sortOrder: 5 },
];

const DEFAULT_UNITS = [
  { name: "Pcs", symbol: "pcs" },
  { name: "Kilogram", symbol: "kg" },
  { name: "Liter", symbol: "l" },
  { name: "Box", symbol: "box" },
  { name: "Pak", symbol: "pak" },
];

const DEFAULT_CATEGORIES = ["Umum", "Makanan", "Minuman"];

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
    const organizationId = createId("org");
    await db.insert(organizations).values({
      id: organizationId,
      name: organizationName,
      slug: "demo-store",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      status: "active",
      taxRate: 1100,
      createdAt: now,
      updatedAt: now,
    });
    organization = (
      await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1)
    )[0];
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

  for (const method of DEFAULT_PAYMENT_METHODS) {
    await db
      .insert(paymentMethods)
      .values({
        id: createId("pm"),
        organizationId: organization.id,
        code: method.code,
        name: method.name,
        sortOrder: method.sortOrder,
        isActive: true,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  for (const unit of DEFAULT_UNITS) {
    await db
      .insert(units)
      .values({
        id: createId("unit"),
        organizationId: organization.id,
        ...unit,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  for (const name of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        id: createId("cat"),
        organizationId: organization.id,
        name,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
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
