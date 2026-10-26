import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { type SessionContext } from "@/lib/auth/session";
import { getAllowedBranchIds, requireBranchAccess, resolveBranchId } from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { addDays, localDateTimeString, parsePeriod, startOfLocalDay } from "@/lib/time/period";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import {
  branches,
  cashMovements,
  memberships,
  payments,
  roles,
  sales,
  shifts,
  users,
} from "@/db/schema";

/** Differences above this amount need a second approver. */
export const SHIFT_DIFFERENCE_THRESHOLD = 10_000;

const CASH_METHODS = ["cash", "tunai"];

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function summarizeShift(
  shift: typeof shifts.$inferSelect,
  db: Database = getDb(),
) {
  const salesTotals = await db
    .select({
      transactionCount: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
      grossTotal: sql<number>`coalesce(sum(case when ${sales.status} = 'voided' then 0 else ${sales.grandTotal} end), 0)`,
      cashTotal: sql<number>`coalesce(sum(case when ${sales.status} = 'voided' then 0 else ${sales.paidTotal} end), 0)`,
    })
    .from(sales)
    .where(eq(sales.shiftId, shift.id));

  const cashPaymentRows = await db
    .select({ amount: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(sales, eq(sales.id, payments.saleId))
    .where(
      and(
        eq(payments.saleId, sales.id),
        eq(sales.shiftId, shift.id),
        eq(payments.status, "paid"),
        inArray(payments.method, CASH_METHODS),
        sql`${sales.status} <> 'voided'`,
      ),
    );
  const cashSales = Number(cashPaymentRows[0]?.amount ?? 0);

  const movementRows = await db
    .select({ type: cashMovements.type, amount: sql<number>`coalesce(sum(${cashMovements.amount}), 0)` })
    .from(cashMovements)
    .where(eq(cashMovements.shiftId, shift.id))
    .groupBy(cashMovements.type);
  const cashIn = Number(movementRows.find((row) => row.type === "in")?.amount ?? 0);
  const cashOut = Number(movementRows.find((row) => row.type === "out")?.amount ?? 0);

  const expected = shift.openingAmount + cashSales + cashIn - cashOut;
  return {
    transactionCount: Number(salesTotals[0]?.transactionCount ?? 0),
    grossTotal: Number(salesTotals[0]?.grossTotal ?? 0),
    cashSales,
    cashIn,
    cashOut,
    expectedAmount: shift.status === "closed" ? (shift.expectedAmount ?? expected) : expected,
  };
}

export async function getCurrentShift(
  session: SessionContext,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftView);
  const branchId = await resolveBranchId(session, branch, db);
  const shift = (
    await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.organizationId, session.organization.id),
          eq(shifts.branchId, branchId),
          eq(shifts.cashierId, session.user.id),
          eq(shifts.status, "open"),
        ),
      )
      .orderBy(desc(shifts.openedAt))
      .limit(1)
  )[0];
  if (!shift) return null;
  const summary = await summarizeShift(shift, db);
  return {
    ...shift,
    ...summary,
    cashierName: session.user.name,
    branchName: (
      await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1)
    )[0]?.name,
  };
}

export async function getShiftForSale(
  session: SessionContext,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  try {
    return await getCurrentShift(session, branch, db);
  } catch {
    return null;
  }
}

export async function openShift(
  session: SessionContext,
  input: { branchId: string; openingAmount: number; notes?: string | null },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftManage);
  await requireBranchAccess(session, input.branchId, db);
  const organizationId = session.organization.id;
  const existing = (
    await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.organizationId, organizationId),
          eq(shifts.branchId, input.branchId),
          eq(shifts.cashierId, session.user.id),
          eq(shifts.status, "open"),
        ),
      )
      .limit(1)
  )[0];
  if (existing) throw ERRORS.conflict("Anda masih memiliki shift terbuka di cabang ini.");

  const id = createId("shf");
  const now = new Date();
  await db.insert(shifts).values({
    id,
    organizationId,
    branchId: input.branchId,
    cashierId: session.user.id,
    status: "open",
    openingAmount: input.openingAmount,
    notes: input.notes ?? null,
    openedAt: now,
    createdAt: now,
  });
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "shift.open",
      entityType: "shift",
      entityId: id,
      branchId: input.branchId,
      afterData: { openingAmount: input.openingAmount },
    },
    db,
  );
  return { id };
}

export async function addCashMovement(
  session: SessionContext,
  shiftId: string,
  input: { type: "in" | "out"; amount: number; reason: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftManage);
  const shift = (
    await db
      .select()
      .from(shifts)
      .where(
        and(eq(shifts.id, shiftId), eq(shifts.organizationId, session.organization.id)),
      )
      .limit(1)
  )[0];
  if (!shift) throw ERRORS.notFound("Shift tidak ditemukan.");
  if (shift.status !== "open") throw ERRORS.conflict("Shift sudah ditutup.");
  await requireBranchAccess(session, shift.branchId, db);
  const role = session.membership.roleCode;
  const elevated = role === "owner" || role === "admin" || role === "manager";
  if (shift.cashierId !== session.user.id && !elevated) {
    throw ERRORS.forbidden("Anda hanya dapat mengubah shift milik sendiri.");
  }
  const id = createId("cm");
  await db.insert(cashMovements).values({
    id,
    organizationId: shift.organizationId,
    shiftId,
    type: input.type,
    amount: input.amount,
    reason: input.reason,
    createdBy: session.user.id,
    createdAt: new Date(),
  });
  await writeAuditBestEffort(
    {
      organizationId: shift.organizationId,
      actorUserId: session.user.id,
      action: `shift.cash_${input.type}`,
      entityType: "shift",
      entityId: shiftId,
      branchId: shift.branchId,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function closeShift(
  session: SessionContext,
  shiftId: string,
  input: { actualAmount: number; notes?: string | null; approvedById?: string | null },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftManage);
  const organizationId = session.organization.id;
  const shift = (
    await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!shift) throw ERRORS.notFound("Shift tidak ditemukan.");
  if (shift.status !== "open") throw ERRORS.conflict("Shift sudah ditutup.");
  await requireBranchAccess(session, shift.branchId, db);
  if (shift.cashierId !== session.user.id && session.membership.roleCode === "cashier") {
    throw ERRORS.forbidden("Anda hanya dapat menutup shift milik sendiri.");
  }

  const summary = await summarizeShift(shift, db);
  const expected = summary.expectedAmount;
  const difference = input.actualAmount - expected;

  let approvedBy: string | null = null;
  if (Math.abs(difference) > SHIFT_DIFFERENCE_THRESHOLD) {
    if (!input.approvedById) {
      throw ERRORS.validation({
        approvedById: `Selisih kas melebihi batas dan membutuhkan persetujuan manajer.`,
      });
    }
    const approver = (
      await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, input.approvedById))
        .limit(1)
    )[0];
    if (!approver) throw ERRORS.validation({ approvedById: "Penyetuju tidak ditemukan." });
    const approverRole = (
      await db
        .select({ code: roles.code })
        .from(memberships)
        .innerJoin(roles, eq(roles.id, memberships.roleId))
        .where(
          and(
            eq(memberships.userId, approver.id),
            eq(memberships.organizationId, organizationId),
          ),
        )
        .limit(1)
    )[0];
    if (
      !approverRole ||
      (approverRole.code !== "owner" &&
        approverRole.code !== "admin" &&
        approverRole.code !== "manager")
    ) {
      throw ERRORS.forbidden("Penyetuju tidak memiliki izin menyetujui selisih kas.");
    }
    if (approver.id === session.user.id) {
      throw ERRORS.forbidden("Selisih kas harus disetujui oleh pengguna lain.");
    }
    approvedBy = approver.id;
  }

  await db.transaction(async (tx) => {
    const fresh = (
      await tx
        .select({ status: shifts.status })
        .from(shifts)
        .where(eq(shifts.id, shiftId))
        .limit(1)
    )[0];
    if (!fresh || fresh.status !== "open") throw ERRORS.conflict("Shift sudah ditutup.");
    await tx
      .update(shifts)
      .set({
        status: "closed",
        closedAt: new Date(),
        expectedAmount: expected,
        actualAmount: input.actualAmount,
        difference,
        notes: input.notes ?? shift.notes,
        approvedBy,
      })
      .where(eq(shifts.id, shiftId));
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "shift.close",
        entityType: "shift",
        entityId: shiftId,
        branchId: shift.branchId,
        beforeData: { openingAmount: shift.openingAmount },
        afterData: {
          expected,
          actual: input.actualAmount,
          difference,
          approvedBy,
        },
      },
      tx as unknown as Database,
    );
  });

  return { id: shiftId, expectedAmount: expected, difference, approvedBy };
}

export async function listShifts(
  session: SessionContext,
  query: {
    branch?: string | null;
    cashier?: string | null;
    status?: string;
    period?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftView);
  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(shifts.organizationId, organizationId)];

  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(eq(shifts.branchId, query.branch));
  } else {
    const allowed = await getAllowedBranchIds(session, db);
    conditions.push(
      allowed.length === 0
        ? sql`1 = 0`
        : sql`${shifts.branchId} in (${sql.join(
            allowed.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    );
  }
  if (query.cashier) conditions.push(eq(shifts.cashierId, query.cashier));
  if (query.status && query.status !== "all") conditions.push(eq(shifts.status, query.status));
  if (query.period || query.from || query.to) {
    const range = parsePeriod(
      { period: query.period, from: query.from, to: query.to },
      timezone,
    );
    conditions.push(gte(shifts.openedAt, range.from));
    conditions.push(lte(shifts.openedAt, new Date(range.to.getTime() - 1)));
  }

  const items = await db
    .select({
      id: shifts.id,
      branchId: shifts.branchId,
      branchName: branches.name,
      cashierId: shifts.cashierId,
      cashierName: users.name,
      status: shifts.status,
      openingAmount: shifts.openingAmount,
      expectedAmount: shifts.expectedAmount,
      actualAmount: shifts.actualAmount,
      difference: shifts.difference,
      notes: shifts.notes,
      openedAt: shifts.openedAt,
      closedAt: shifts.closedAt,
      cashIn: sql<number>`coalesce((select sum(amount) from cash_movements where shift_id = ${shifts.id} and type = 'in'), 0)`,
      cashOut: sql<number>`coalesce((select sum(amount) from cash_movements where shift_id = ${shifts.id} and type = 'out'), 0)`,
    })
    .from(shifts)
    .innerJoin(branches, eq(branches.id, shifts.branchId))
    .innerJoin(users, eq(users.id, shifts.cashierId))
    .where(and(...conditions))
    .orderBy(desc(shifts.openedAt))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(shifts)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function getShift(
  session: SessionContext,
  shiftId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftView);
  const shift = (
    await db
      .select()
      .from(shifts)
      .where(
        and(eq(shifts.id, shiftId), eq(shifts.organizationId, session.organization.id)),
      )
      .limit(1)
  )[0];
  if (!shift) throw ERRORS.notFound("Shift tidak ditemukan.");
  await requireBranchAccess(session, shift.branchId, db);
  const summary = await summarizeShift(shift, db);
  const movements = await db
    .select({
      id: cashMovements.id,
      type: cashMovements.type,
      amount: cashMovements.amount,
      reason: cashMovements.reason,
      actorName: users.name,
      createdAt: cashMovements.createdAt,
    })
    .from(cashMovements)
    .leftJoin(users, eq(users.id, cashMovements.createdBy))
    .where(eq(cashMovements.shiftId, shiftId))
    .orderBy(desc(cashMovements.createdAt));
  const saleRows = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      status: sales.status,
      grandTotal: sales.grandTotal,
      paidTotal: sales.paidTotal,
      soldAt: sales.soldAt,
    })
    .from(sales)
    .where(eq(sales.shiftId, shiftId))
    .orderBy(desc(sales.soldAt))
    .limit(200);
  const cashier = (
    await db.select({ name: users.name }).from(users).where(eq(users.id, shift.cashierId)).limit(1)
  )[0];
  const branch = (
    await db.select({ name: branches.name }).from(branches).where(eq(branches.id, shift.branchId)).limit(1)
  )[0];
  return {
    ...shift,
    ...summary,
    cashierName: cashier?.name ?? null,
    branchName: branch?.name ?? null,
    movements,
    sales: saleRows,
  };
}

/** Local display helpers used by shift screens. */
export function shiftPeriodLabel(from?: string, to?: string, timezone = "Asia/Jakarta") {
  if (from && to) return `${from} — ${to}`;
  return localDateTimeString(new Date(), timezone);
}

export { startOfLocalDay, addDays };

/**
 * People who may approve a cash difference. Only roles that outrank the
 * closing cashier are eligible, and the caller itself is excluded.
 */
export async function listShiftApprovers(
  session: SessionContext,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.shiftManage);
  return db
    .selectDistinct({ id: users.id, name: users.name })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.organizationId, session.organization.id),
        eq(memberships.status, "active"),
        eq(users.status, "active"),
        inArray(roles.code, ["owner", "admin", "manager"]),
        ne(users.id, session.user.id),
      ),
    )
    .orderBy(asc(users.name));
}
