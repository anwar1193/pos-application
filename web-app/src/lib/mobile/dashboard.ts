import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { resolveBranchId } from "@/lib/branches/service";
import { getCurrentShift } from "@/lib/shifts/service";
import { dayRange, localDateString } from "@/lib/time/period";
import { branches, customers, refunds, sales } from "@/db/schema";

export type MobileDashboardPayload = {
  user: { name: string };
  organization: { name: string; currency: string; timezone: string };
  branch: { id: string; name: string };
  dateLabel: string;
  shift: {
    id: string;
    openedAt: Date;
    openingAmount: number;
    expectedAmount: number;
    transactionCount: number;
    grossTotal: number;
    cashierName: string;
    branchName: string | null;
  } | null;
  today: {
    net: number;
    transactions: number;
    itemsSold: number;
    comparison: { grossPercent: number | null; transactionsPercent: number | null };
  };
  recentSales: {
    id: string;
    receiptNumber: string;
    customerName: string | null;
    grandTotal: number;
    status: string;
    soldAt: Date;
  }[];
};

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Compact dashboard payload for the mobile home screen. Access is guarded by
 * shift.view + sale.view because cashiers do not hold dashboard.view.
 */
export async function getMobileDashboard(
  session: SessionContext,
  db: Database = getDb(),
): Promise<MobileDashboardPayload> {
  requireApiPermission(session, PERMISSIONS.shiftView);
  requireApiPermission(session, PERMISSIONS.saleView);

  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const branchId = await resolveBranchId(session, undefined, db);

  const branch = (
    await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1)
  )[0];
  if (!branch) throw new Error("Branch not found for mobile dashboard.");

  const shift = await getCurrentShift(session, branchId, db);

  const todayRange = dayRange(new Date(), timezone);
  const yesterdayDate = new Date(todayRange.from.getTime() - 12 * 60 * 60 * 1000);
  const yesterdayRange = dayRange(yesterdayDate, timezone);

  const baseConditions: SQL[] = [
    eq(sales.organizationId, organizationId),
    eq(sales.branchId, branchId),
  ];

  async function totals(from: Date, to: Date) {
    const rows = await db
      .select({
        gross: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.grandTotal} else 0 end), 0)`,
        transactions: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
        itemsSold: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then (
          select coalesce(sum(si.quantity), 0) from sale_items si where si.sale_id = sales.id
        ) else 0 end), 0)`,
      })
      .from(sales)
      .where(
        and(
          ...baseConditions,
          gte(sales.soldAt, from),
          lte(sales.soldAt, new Date(to.getTime() - 1)),
        ),
      );

    const refundRows = await db
      .select({ amount: sql<number>`coalesce(sum(${refunds.amount}), 0)` })
      .from(refunds)
      .innerJoin(sales, eq(sales.id, refunds.saleId))
      .where(
        and(
          ...baseConditions,
          eq(refunds.status, "approved"),
          gte(refunds.createdAt, from),
          lte(refunds.createdAt, new Date(to.getTime() - 1)),
        ),
      );

    return {
      gross: Number(rows[0]?.gross ?? 0),
      transactions: Number(rows[0]?.transactions ?? 0),
      itemsSold: Number(rows[0]?.itemsSold ?? 0),
      refunds: Number(refundRows[0]?.amount ?? 0),
    };
  }

  const today = await totals(todayRange.from, todayRange.to);
  const yesterday = await totals(yesterdayRange.from, yesterdayRange.to);

  const recentSales = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      customerName: customers.name,
      grandTotal: sales.grandTotal,
      status: sales.status,
      soldAt: sales.soldAt,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(and(...baseConditions))
    .orderBy(desc(sales.soldAt))
    .limit(3);

  return {
    user: { name: session.user.name },
    organization: {
      name: session.organization.name,
      currency: session.organization.currency,
      timezone,
    },
    branch,
    dateLabel: localDateString(new Date(), timezone),
    shift: shift
      ? {
          id: shift.id,
          openedAt: shift.openedAt,
          openingAmount: Number(shift.openingAmount),
          expectedAmount: Number(shift.expectedAmount),
          transactionCount: shift.transactionCount,
          grossTotal: shift.grossTotal,
          cashierName: shift.cashierName ?? session.user.name,
          branchName: shift.branchName ?? branch.name,
        }
      : null,
    today: {
      net: today.gross - today.refunds,
      transactions: today.transactions,
      itemsSold: today.itemsSold,
      comparison: {
        grossPercent: percentChange(today.gross, yesterday.gross),
        transactionsPercent: percentChange(today.transactions, yesterday.transactions),
      },
    },
    recentSales,
  };
}
