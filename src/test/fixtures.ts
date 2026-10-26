import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";
import { createSession, validateSessionToken } from "@/lib/auth/session";
import { createId } from "@/lib/ids";
import type { Database } from "@/lib/db/client";

const MIGRATION_SQL = readFileSync(
  new URL("../db/migrations/0000_naive_true_believers.sql", import.meta.url),
  "utf8",
);

export type TestContext = {
  db: Database;
  close: () => Promise<void>;
};

/**
 * Creates an isolated SQLite database (one temp file per test) and applies the
 * real generated migration, so service tests run against the same schema
 * production uses.
 */
export async function createTestDatabase(): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), "pos-test-"));
  const client = createClient({ url: `file:${join(dir, "test.db")}` });

  for (const statement of MIGRATION_SQL.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await client.execute(sql);
  }

  const db = drizzle(client, { schema }) as Database;

  return {
    db,
    async close() {
      client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export type RbacFixture = {
  roleIds: Record<RoleCode, string>;
  permissionIds: Map<Permission, string>;
};

export async function seedRbac(db: Database): Promise<RbacFixture> {
  const now = new Date();
  const permissionIds = new Map<Permission, string>();

  for (const code of Object.values(PERMISSIONS) as Permission[]) {
    const id = createId("perm");
    await db.insert(schema.permissions).values({ id, code, description: code });
    permissionIds.set(code, id);
  }

  const roleIds = {} as Record<RoleCode, string>;
  for (const code of Object.values(ROLE_CODES) as RoleCode[]) {
    const id = createId("role");
    await db.insert(schema.roles).values({
      id,
      organizationId: null,
      code,
      name: code,
      isSystem: true,
      createdAt: now,
    });
    roleIds[code] = id;

    for (const permission of ROLE_PERMISSIONS[code]) {
      await db.insert(schema.rolePermissions).values({
        roleId: id,
        permissionId: permissionIds.get(permission)!,
      });
    }
  }

  return { roleIds, permissionIds };
}

export async function seedOrganization(
  db: Database,
  name = "Demo Store",
): Promise<{ organizationId: string; branchId: string }> {
  const now = new Date();
  const organizationId = createId("org");
  await db.insert(schema.organizations).values({
    id: organizationId,
    name,
    slug: createId("slug"),
    currency: "IDR",
    timezone: "Asia/Jakarta",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const branchId = createId("br");
  await db.insert(schema.branches).values({
    id: branchId,
    organizationId,
    name: "Cabang Utama",
    code: createId("code"),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return { organizationId, branchId };
}

export async function seedUser(
  db: Database,
  input: {
    email: string;
    name?: string;
    password?: string;
    roleId: string;
    organizationId: string;
    branchId?: string | null;
    status?: "active" | "invited" | "suspended" | "disabled";
    membershipStatus?: "active" | "invited" | "suspended";
  },
): Promise<{ userId: string; membershipId: string }> {
  const now = new Date();
  const userId = createId("usr");
  const passwordHash = input.password ? await hashPassword(input.password) : null;

  await db.insert(schema.users).values({
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name ?? input.email,
    phone: null,
    passwordHash,
    status: input.status ?? (passwordHash ? "active" : "invited"),
    emailVerifiedAt: passwordHash ? now : null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  });

  const membershipId = createId("mem");
  await db.insert(schema.memberships).values({
    id: membershipId,
    organizationId: input.organizationId,
    userId,
    roleId: input.roleId,
    defaultBranchId: input.branchId ?? null,
    status: input.membershipStatus ?? "active",
    createdAt: now,
    updatedAt: now,
  });

  return { userId, membershipId };
}

export async function sessionFor(
  db: Database,
  userId: string,
  organizationId: string,
) {
  const { token } = await createSession({ userId, organizationId, db });
  const session = await validateSessionToken(token, db);
  if (!session) throw new Error("Fixture session failed validation.");
  return { session, token };
}

export const TEST_META = {
  ipHash: "test-ip",
  userAgent: "vitest",
  requestId: "test-request",
};
