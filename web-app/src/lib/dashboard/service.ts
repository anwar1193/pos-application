import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { requireBranchAccess, resolveBranchId } from "@/lib/branches/service";
import { dayRange, localDateString } from "@/lib/time/period";
import {
  auditLogs,
  branches,
  categories,
  payments,
  products,
  refunds,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";

export type DashboardSummary = {
  organization: { id: string; name: string; currency: string; timezone: string };
  branch: { id: string; name: string } | null;
  dateLabel: string;
  today: {
    gross: number;
    refunds: number;
    net: number;
    transactions: number;
    average: number;
    itemsSold: number;
  };
  yesterday: { gross: number; transactions: number };
  comparison: { grossPercent: number | null; transactionsPercent: number | null };
  topProducts: { productId: string | null; name: string; sku: string; quantity: number; revenue: number }[];
  lowStock: { productId: string; name: string; sku: string; quantity: number; minimumStock: number }[];
  paymentMethods: { method: string; amount: number; count: number }[];
  activeShifts: {
    id: string;
    cashierName: string;
    openingAmount: number;
    openedAt: Date;
  }[];
  recentSales: {
    id: string;
    receiptNumber: string;
    customerName: string | null;
    cashierName: string;
    grandTotal: number;
    status: string;
    soldAt: Date;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorName: string | null;
    createdAt: Date;
  }[];
};

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboardSummary(
  session: SessionContext,
  options: { branchId?: string | null } = {},
  db: Database = getDb(),
): Promise<DashboardSummary> {
  requireApiPermission(session, PERMISSIONS.dashboardView);
  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const branchId = await resolveBranchId(session, options.branchId, db);
  await requireBranchAccess(session, branchId, db);

  const branch = (
    await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1)
  )[0];

  const todayRange = dayRange(new Date(), timezone);
  const yesterdayDate = new Date(todayRange.from.getTime() - 12 * 60 * 60 * 1000);
  const yesterdayRange = dayRange(yesterdayDate, timezone);

  const baseConditions: SQL[] = [
    eq(sales.organizationId, organizationId),
    eq(sales.branchId, branchId),
  ];

  async function salesTotals(from: Date, to: Date) {
    const rows = await db
      .select({
        gross: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.grandTotal} else 0 end), 0)`,
        transactions: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
        itemsSold: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then (
          select coalesce(sum(si.quantity), 0) from sale_items si where si.sale_id = ${sales.id}
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

  const todayTotals = await salesTotals(todayRange.from, todayRange.to);
  const yesterdayTotals = await salesTotals(yesterdayRange.from, yesterdayRange.to);

  const topProducts = await db
    .select({
      productId: saleItems.productId,
      name: saleItems.productName,
      sku: saleItems.sku,
      quantity: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
      revenue: sql<number>`coalesce(sum(${saleItems.lineTotal} - ${saleItems.taxAmount}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(
      and(
        ...baseConditions,
        sql`${sales.status} <> 'voided'`,
        gte(sales.soldAt, todayRange.from),
        lte(sales.soldAt, new Date(todayRange.to.getTime() - 1)),
      ),
    )
    .groupBy(saleItems.productId, saleItems.productName, saleItems.sku)
    .orderBy(desc(sql`sum(${saleItems.lineTotal} - ${saleItems.taxAmount})`))
    .limit(5);

  const lowStock = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      quantity: sql<number>`coalesce((
        select b.quantity from inventory_balances b
        where b.branch_id = ${branchId} and b.product_id = ${products.id}
      ), 0)`,
      minimumStock: products.minimumStock,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.status, "active"),
        eq(products.trackStock, true),
        sql`coalesce((
          select b.quantity from inventory_balances b
          where b.branch_id = ${branchId} and b.product_id = ${products.id}
        ), 0) <= ${products.minimumStock}`,
      ),
    )
    .orderBy(asc(products.name))
    .limit(6);

  const paymentRows = await db
    .select({
      method: payments.method,
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .innerJoin(sales, eq(sales.id, payments.saleId))
    .where(
      and(
        ...baseConditions,
        eq(payments.status, "paid"),
        sql`${sales.status} <> 'voided'`,
        gte(sales.soldAt, todayRange.from),
        lte(sales.soldAt, new Date(todayRange.to.getTime() - 1)),
      ),
    )
    .groupBy(payments.method)
    .orderBy(desc(sql`sum(${payments.amount})`));

  const changeRows = await db
    .select({ change: sql<number>`coalesce(sum(${sales.changeTotal}), 0)` })
    .from(sales)
    .where(
      and(
        ...baseConditions,
        sql`${sales.status} <> 'voided'`,
        gte(sales.soldAt, todayRange.from),
        lte(sales.soldAt, new Date(todayRange.to.getTime() - 1)),
      ),
    );
  const totalChange = Number(changeRows[0]?.change ?? 0);

  const activeShiftRows = await db
    .select({
      id: shifts.id,
      cashierName: users.name,
      openingAmount: shifts.openingAmount,
      openedAt: shifts.openedAt,
    })
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.cashierId))
    .where(
      and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.branchId, branchId),
        eq(shifts.status, "open"),
      ),
    )
    .orderBy(asc(shifts.openedAt))
    .limit(5);

  const recentSales = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      customerName: sql<string | null>`(select name from customers where id = ${sales.customerId})`,
      cashierName: users.name,
      grandTotal: sales.grandTotal,
      status: sales.status,
      soldAt: sales.soldAt,
    })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.cashierId))
    .where(and(...baseConditions))
    .orderBy(desc(sales.soldAt))
    .limit(8);

  const recentActivity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorName: users.name,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.branchId, branchId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);

  const net = todayTotals.gross - todayTotals.refunds;
  const average =
    todayTotals.transactions > 0 ? Math.round(net / todayTotals.transactions) : 0;

  return {
    organization: {
      id: organizationId,
      name: session.organization.name,
      currency: session.organization.currency,
      timezone,
    },
    branch: branch ?? null,
    dateLabel: localDateString(new Date(), timezone),
    today: {
      gross: todayTotals.gross,
      refunds: todayTotals.refunds,
      net,
      transactions: todayTotals.transactions,
      average,
      itemsSold: todayTotals.itemsSold,
    },
    yesterday: {
      gross: yesterdayTotals.gross,
      transactions: yesterdayTotals.transactions,
    },
    comparison: {
      grossPercent: percentChange(todayTotals.gross, yesterdayTotals.gross),
      transactionsPercent: percentChange(todayTotals.transactions, yesterdayTotals.transactions),
    },
    topProducts: topProducts.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    })),
    lowStock: lowStock.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
    })),
    paymentMethods: paymentRows.map((row) => {
      const isCash = row.method === "cash" || row.method === "tunai";
      return {
        method: row.method,
        amount: Number(row.amount) - (isCash ? totalChange : 0),
        count: Number(row.count),
      };
    }),
    activeShifts: activeShiftRows.map((row) => ({
      ...row,
      openingAmount: Number(row.openingAmount),
    })),
    recentSales,
    recentActivity,
  };
}

/** Category breakdown used by the dashboard chart. */
export async function getCategoryBreakdown(
  session: SessionContext,
  options: { branchId?: string | null } = {},
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.dashboardView);
  const organizationId = session.organization.id;
  const branchId = await resolveBranchId(session, options.branchId, db);
  const range = dayRange(new Date(), session.organization.timezone);
  return db
    .select({
      categoryName: sql<string>`coalesce(${categories.name}, 'Tanpa kategori')`,
      revenue: sql<number>`coalesce(sum(${saleItems.lineTotal} - ${saleItems.taxAmount}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .leftJoin(products, eq(products.id, saleItems.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(sales.organizationId, organizationId),
        eq(sales.branchId, branchId),
        sql`${sales.status} <> 'voided'`,
        gte(sales.soldAt, range.from),
        lte(sales.soldAt, new Date(range.to.getTime() - 1)),
      ),
    )
    .groupBy(categories.name)
    .orderBy(desc(sql`sum(${saleItems.lineTotal} - ${saleItems.taxAmount})`));
}
