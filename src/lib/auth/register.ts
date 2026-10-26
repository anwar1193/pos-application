import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import { normalizeEmail } from "@/lib/auth/tokens";
import { ERRORS } from "@/lib/http/errors";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { createId } from "@/lib/ids";
import {
  ensureSystemRoles,
  organizationSlug,
  seedOrganizationDefaults,
} from "@/lib/settings/bootstrap";
import { branches, memberships, organizations, users } from "@/db/schema";

export type RegisterInput = {
  organizationName: string;
  name: string;
  email: string;
  password: string;
  timezone?: string;
  currency?: string;
};

/**
 * Creates a business, its first branch, and an owner account. Registration is
 * the only place a new organization is created; role and organization are
 * always derived server-side.
 */
export async function registerBusiness(
  input: RegisterInput,
  db: Database = getDb(),
): Promise<{ userId: string; organizationId: string; branchId: string }> {
  const email = normalizeEmail(input.email);
  const policyError = validatePasswordPolicy(input.password, {
    email,
    name: input.name,
  });
  if (policyError) throw ERRORS.validation({ password: policyError });

  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (existing) {
    throw ERRORS.conflict("Email sudah terdaftar. Silakan masuk atau gunakan email lain.");
  }

  const roleIds = await ensureSystemRoles(db);
  const ownerRoleId = roleIds.get("owner");
  if (!ownerRoleId) {
    throw ERRORS.server();
  }

  const now = new Date();
  const organizationId = createId("org");
  const branchId = createId("br");
  const userId = createId("usr");
  const membershipId = createId("mem");
  const passwordHash = await hashPassword(input.password);

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name: input.organizationName,
      slug: organizationSlug(input.organizationName),
      currency: (input.currency ?? "IDR").toUpperCase(),
      timezone: input.timezone || "Asia/Jakarta",
      taxRate: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(branches).values({
      id: branchId,
      organizationId,
      name: "Cabang Utama",
      code: "MAIN",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(users).values({
      id: userId,
      email,
      name: input.name,
      passwordHash,
      status: "active",
      emailVerifiedAt: now,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(memberships).values({
      id: membershipId,
      organizationId,
      userId,
      roleId: ownerRoleId,
      defaultBranchId: branchId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await seedOrganizationDefaults(tx as unknown as Database, organizationId, now);
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: userId,
        action: "organization.registered",
        entityType: "organization",
        entityId: organizationId,
        branchId,
        afterData: { organizationName: input.organizationName },
      },
      tx as unknown as Database,
    );
  });

  return { userId, organizationId, branchId };
}
