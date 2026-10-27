import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";
import { createId } from "@/lib/ids";
import {
  categories,
  paymentMethods,
  permissions,
  rolePermissions,
  roles,
  units,
} from "@/db/schema";

export const DEFAULT_PAYMENT_METHODS = [
  { code: "cash", name: "Tunai", sortOrder: 1 },
  { code: "card", name: "Kartu Debit/Kredit", sortOrder: 2 },
  { code: "transfer", name: "Transfer Bank", sortOrder: 3 },
  { code: "qr", name: "QRIS", sortOrder: 4 },
  { code: "manual", name: "Pembayaran Manual", sortOrder: 5 },
];

export const DEFAULT_UNITS = [
  { name: "Pcs", symbol: "pcs" },
  { name: "Kilogram", symbol: "kg" },
  { name: "Liter", symbol: "l" },
  { name: "Box", symbol: "box" },
  { name: "Pak", symbol: "pak" },
];

export const DEFAULT_CATEGORIES = ["Umum", "Makanan", "Minuman"];

/**
 * Ensures system permissions and role definitions exist. Safe to call more
 * than once; used by registration so a fresh database is usable without the
 * seed script.
 */
export async function ensureSystemRoles(db: Database) {
  const now = new Date();
  const permissionRows = Object.entries(PERMISSION_DESCRIPTIONS).map(([code, description]) => ({
    id: `perm_${code.replaceAll(".", "_")}`,
    code,
    description,
  }));
  for (const permission of permissionRows) {
    await db
      .insert(permissions)
      .values(permission)
      .onConflictDoUpdate({ target: permissions.code, set: { description: permission.description } });
  }

  const roleIds = new Map<RoleCode, string>();
  for (const code of Object.values(ROLE_CODES)) {
    const existing = (
      await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.code, code), eq(roles.isSystem, true), isNull(roles.organizationId)))
        .limit(1)
    )[0];
    if (existing) {
      roleIds.set(code, existing.id);
      continue;
    }
    const id = createId("role");
    await db.insert(roles).values({
      id,
      organizationId: null,
      code,
      name: ROLE_NAMES[code],
      isSystem: true,
      createdAt: now,
    });
    roleIds.set(code, id);
  }

  for (const [code, granted] of Object.entries(ROLE_PERMISSIONS) as [RoleCode, Permission[]][]) {
    const roleId = roleIds.get(code);
    if (!roleId) continue;
    for (const permissionCode of granted) {
      const permission = permissionRows.find((row) => row.code === permissionCode);
      if (!permission) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: permission.id })
        .onConflictDoNothing();
    }
  }

  return roleIds;
}

/** Creates the starter catalogue choices every new business needs. */
export async function seedOrganizationDefaults(
  db: Database,
  organizationId: string,
  now = new Date(),
) {
  for (const method of DEFAULT_PAYMENT_METHODS) {
    await db.insert(paymentMethods).values({
      id: createId("pm"),
      organizationId,
      code: method.code,
      name: method.name,
      isActive: true,
      sortOrder: method.sortOrder,
      createdAt: now,
    });
  }
  for (const unit of DEFAULT_UNITS) {
    await db.insert(units).values({
      id: createId("unit"),
      organizationId,
      name: unit.name,
      symbol: unit.symbol,
      createdAt: now,
    });
  }
  for (const name of DEFAULT_CATEGORIES) {
    await db.insert(categories).values({
      id: createId("cat"),
      organizationId,
      name,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** Slugifies a business name and adds a short suffix for uniqueness. */
export function organizationSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "toko";
  return `${base}-${createId("s").slice(2, 8)}`;
}
