import { and, asc, count, desc, eq, gte, like, lt, or, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { startOfLocalDay, addDays, localDateString } from "@/lib/time/period";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import {
  auditLogs,
  branches,
  organizations,
  paymentMethods,
  users,
} from "@/db/schema";

export type OrganizationConfig = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  receiptPrefix: string;
  taxRate: number;
  allowNegativeStock: boolean;
};

/** Internal helper — no permission check; callers must already be authorized. */
export async function getOrganizationConfig(
  organizationId: string,
  db: Database = getDb(),
): Promise<OrganizationConfig> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      currency: organizations.currency,
      timezone: organizations.timezone,
      phone: organizations.phone,
      address: organizations.address,
      receiptPrefix: organizations.receiptPrefix,
      taxRate: organizations.taxRate,
      allowNegativeStock: organizations.allowNegativeStock,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERRORS.notFound("Organisasi tidak ditemukan.");
  return row;
}

export async function getSettingsOverview(session: SessionContext, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organization = await getOrganizationConfig(session.organization.id, db);
  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, session.organization.id))
    .orderBy(asc(branches.name));
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.organizationId, session.organization.id))
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
  return { organization, branches: branchRows, paymentMethods: methods };
}

export async function updateOrganizationSettings(
  session: SessionContext,
  input: {
    name?: string;
    phone?: string | null;
    address?: string | null;
    timezone?: string;
    currency?: string;
    receiptPrefix?: string;
    taxRate?: number;
    allowNegativeStock?: boolean;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organizationId = session.organization.id;
  const before = await getOrganizationConfig(organizationId, db);

  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
    } catch {
      throw ERRORS.validation({ timezone: "Zona waktu tidak valid." });
    }
  }
  if (input.currency && !/^[A-Z]{3}$/.test(input.currency)) {
    throw ERRORS.validation({ currency: "Kode mata uang harus 3 huruf." });
  }

  await db
    .update(organizations)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.receiptPrefix !== undefined ? { receiptPrefix: input.receiptPrefix } : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
      ...(input.allowNegativeStock !== undefined
        ? { allowNegativeStock: input.allowNegativeStock }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "settings.organization.update",
      entityType: "organization",
      entityId: organizationId,
      beforeData: before,
      afterData: input,
    },
    db,
  );
  return getOrganizationConfig(organizationId, db);
}

export async function createBranch(
  session: SessionContext,
  input: { name: string; code: string; phone?: string | null; address?: string | null; isActive?: boolean },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organizationId = session.organization.id;
  const duplicate = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.organizationId, organizationId), eq(branches.code, input.code)))
    .limit(1);
  if (duplicate[0]) throw ERRORS.validation({ code: "Kode cabang sudah dipakai." });

  const id = createId("br");
  const now = new Date();
  await db.insert(branches).values({
    id,
    organizationId,
    name: input.name,
    code: input.code,
    phone: input.phone || null,
    address: input.address || null,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "settings.branch.create",
      entityType: "branch",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updateBranch(
  session: SessionContext,
  branchId: string,
  input: {
    name?: string;
    code?: string;
    phone?: string | null;
    address?: string | null;
    isActive?: boolean;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Cabang tidak ditemukan.");

  if (input.code && input.code !== current.code) {
    const duplicate = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.organizationId, organizationId), eq(branches.code, input.code)))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== branchId) {
      throw ERRORS.validation({ code: "Kode cabang sudah dipakai." });
    }
  }
  if (input.isActive === false && current.isActive) {
    const activeRows = await db
      .select({ value: count() })
      .from(branches)
      .where(and(eq(branches.organizationId, organizationId), eq(branches.isActive, true)));
    if ((activeRows[0]?.value ?? 0) <= 1) {
      throw ERRORS.conflict("Minimal satu cabang aktif harus tersedia.");
    }
  }

  await db
    .update(branches)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(branches.id, branchId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "settings.branch.update",
      entityType: "branch",
      entityId: branchId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: branchId };
}

export async function listPaymentMethods(
  session: SessionContext,
  options: { includeInactive?: boolean } = {},
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  const conditions: SQL[] = [eq(paymentMethods.organizationId, session.organization.id)];
  if (!options.includeInactive) conditions.push(eq(paymentMethods.isActive, true));
  return db
    .select()
    .from(paymentMethods)
    .where(and(...conditions))
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
}

export async function createPaymentMethod(
  session: SessionContext,
  input: { code: string; name: string; isActive?: boolean; sortOrder?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organizationId = session.organization.id;
  const duplicate = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(
      and(eq(paymentMethods.organizationId, organizationId), eq(paymentMethods.code, input.code)),
    )
    .limit(1);
  if (duplicate[0]) throw ERRORS.validation({ code: "Kode metode sudah dipakai." });

  const id = createId("pm");
  await db.insert(paymentMethods).values({
    id,
    organizationId,
    code: input.code,
    name: input.name,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date(),
  });
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "settings.payment_method.create",
      entityType: "payment_method",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updatePaymentMethod(
  session: SessionContext,
  methodId: string,
  input: { code?: string; name?: string; isActive?: boolean; sortOrder?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.settingsManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(paymentMethods)
      .where(
        and(eq(paymentMethods.id, methodId), eq(paymentMethods.organizationId, organizationId)),
      )
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Metode pembayaran tidak ditemukan.");
  if (input.code && input.code !== current.code) {
    const duplicate = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(
        and(eq(paymentMethods.organizationId, organizationId), eq(paymentMethods.code, input.code)),
      )
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== methodId) {
      throw ERRORS.validation({ code: "Kode metode sudah dipakai." });
    }
  }
  await db
    .update(paymentMethods)
    .set({
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(paymentMethods.id, methodId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "settings.payment_method.update",
      entityType: "payment_method",
      entityId: methodId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: methodId };
}

export async function listAuditLogs(
  session: SessionContext,
  query: {
    q?: string;
    action?: string;
    actor?: string | null;
    branch?: string | null;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.auditView);
  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const conditions: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (query.action) conditions.push(like(auditLogs.action, `%${query.action}%`));
  if (query.actor) conditions.push(eq(auditLogs.actorUserId, query.actor));
  if (query.branch) conditions.push(eq(auditLogs.branchId, query.branch));
  if (query.from) conditions.push(gte(auditLogs.createdAt, startOfLocalDay(query.from, timezone)));
  if (query.to) {
    conditions.push(lt(auditLogs.createdAt, startOfLocalDay(addDays(query.to, 1), timezone)));
  }
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(
      like(auditLogs.action, term),
      like(auditLogs.entityType, term),
      like(auditLogs.entityId, term),
      like(auditLogs.metadata, term),
    );
    if (search) conditions.push(search);
  }

  const items = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      branchId: auditLogs.branchId,
      actorUserId: auditLogs.actorUserId,
      actorName: users.name,
      beforeData: auditLogs.beforeData,
      afterData: auditLogs.afterData,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRows = await db
    .select({ value: count() })
    .from(auditLogs)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export function todayLabel(timezone: string): string {
  return localDateString(new Date(), timezone);
}
