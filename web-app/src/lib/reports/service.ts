import { and, asc, desc, eq, gte, lte, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { getAllowedBranchIds, requireBranchAccess } from "@/lib/branches/service";
import { formatMoney } from "@/lib/format/money";
import { parsePeriod, timeZoneOffset } from "@/lib/time/period";
import {
  branches,
  categories,
  payments,
  products,
  purchaseOrders,
  refunds,
  saleItems,
  sales,
  shifts,
  stockMovements,
  suppliers,
  users,
} from "@/db/schema";

type Column = { key: string; header: string };

export type ReportResult = {
  type: string;
  title: string;
  range: { fromDate: string; toDate: string; from: string; to: string };
  summary: { label: string; value: string }[];
  columns: Column[];
  rows: Record<string, unknown>[];
};

function money(value: number): string {
  return formatMoney(Number(value) || 0);
}

function branchCondition(
  session: SessionContext,
  allowed: string[],
  requested: string | null | undefined,
  column: SQL | AnyColumn,
): SQL {
  if (requested) {
    return sql`${column} = ${requested}`;
  }
  if (allowed.length === 0) return sql`1 = 0`;
  return sql`${column} in (${sql.join(
    allowed.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

async function resolveScope(
  session: SessionContext,
  query: { branch?: string | null },
  db: Database,
) {
  if (query.branch) await requireBranchAccess(session, query.branch, db);
  const allowed = await getAllowedBranchIds(session, db);
  return { allowed, requested: query.branch ?? null };
}

function offsetModifier(from: Date, timezone: string): string {
  const hours = timeZoneOffset(from, timezone) / 3_600_000;
  const sign = hours >= 0 ? "+" : "-";
  const absolute = Math.abs(hours);
  const whole = Math.floor(absolute);
  const minutes = Math.round((absolute - whole) * 60);
  return `${sign}${whole} hours${minutes ? ` ${sign}${minutes} minutes` : ""}`;
}

function dayExpression(from: Date, timezone: string) {
  return sql<string>`strftime('%Y-%m-%d', ${sales.soldAt} / 1000, 'unixepoch', ${offsetModifier(
    from,
    timezone,
  )})`;
}

async function baseSalesConditions(
  session: SessionContext,
  query: {
    branch?: string | null;
    cashier?: string | null;
    category?: string | null;
    period?: string;
    from?: string;
    to?: string;
  },
  db: Database,
) {
  const scope = await resolveScope(session, query, db);
  const range = parsePeriod(
    { period: query.period, from: query.from, to: query.to },
    session.organization.timezone,
  );
  const conditions: SQL[] = [
    eq(sales.organizationId, session.organization.id),
    gte(sales.soldAt, range.from),
    lte(sales.soldAt, new Date(range.to.getTime() - 1)),
  ];
  conditions.push(branchCondition(session, scope.allowed, scope.requested, sales.branchId));
  if (query.cashier) conditions.push(eq(sales.cashierId, query.cashier));
  if (query.category) conditions.push(eq(products.categoryId, query.category));
  return { conditions, range };
}

export async function getReport(
  session: SessionContext,
  query: {
    type?: string;
    branch?: string | null;
    cashier?: string | null;
    category?: string | null;
    period?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
): Promise<ReportResult> {
  requireApiPermission(session, PERMISSIONS.reportView);
  const type = query.type ?? "sales";
  const timezone = session.organization.timezone;

  if (type === "sales") {
    const { conditions, range } = await baseSalesConditions(session, query, db);
    const day = dayExpression(range.from, timezone);
    const rows = await db
      .select({
        date: day,
        transactions: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
        gross: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.grandTotal} else 0 end), 0)`,
        discount: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.discountTotal} else 0 end), 0)`,
        tax: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.taxTotal} else 0 end), 0)`,
        refunds: sql<number>`coalesce((
          select sum(r.amount) from refunds r
          where r.organization_id = ${session.organization.id} and r.status = 'approved'
            and strftime('%Y-%m-%d', r.created_at / 1000, 'unixepoch', ${offsetModifier(
              range.from,
              timezone,
            )}) = ${day}
        ), 0)`,
      })
      .from(sales)
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(...conditions))
      .groupBy(day)
      .orderBy(asc(day));

    const totals = rows.reduce(
      (acc, row) => ({
        transactions: acc.transactions + Number(row.transactions),
        gross: acc.gross + Number(row.gross),
        discount: acc.discount + Number(row.discount),
        tax: acc.tax + Number(row.tax),
        refunds: acc.refunds + Number(row.refunds),
      }),
      { transactions: 0, gross: 0, discount: 0, tax: 0, refunds: 0 },
    );

    return {
      type,
      title: "Laporan Penjualan",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Transaksi", value: String(totals.transactions) },
        { label: "Penjualan bruto", value: money(totals.gross) },
        { label: "Diskon", value: money(totals.discount) },
        { label: "Pajak", value: money(totals.tax) },
        { label: "Refund", value: money(totals.refunds) },
        { label: "Penjualan bersih", value: money(totals.gross - totals.refunds) },
      ],
      columns: [
        { key: "date", header: "Tanggal" },
        { key: "transactions", header: "Transaksi" },
        { key: "gross", header: "Bruto" },
        { key: "discount", header: "Diskon" },
        { key: "tax", header: "Pajak" },
        { key: "refunds", header: "Refund" },
        { key: "net", header: "Bersih" },
      ],
      rows: rows.map((row) => ({
        ...row,
        gross: Number(row.gross),
        discount: Number(row.discount),
        tax: Number(row.tax),
        refunds: Number(row.refunds),
        net: Number(row.gross) - Number(row.refunds),
      })),
    };
  }

  if (type === "products" || type === "margin") {
    const { conditions, range } = await baseSalesConditions(session, query, db);
    const rows = await db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productName,
        sku: saleItems.sku,
        categoryName: categories.name,
        quantity: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(${saleItems.lineTotal} - ${saleItems.taxAmount}), 0)`,
        cost: sql<number>`coalesce(sum(${saleItems.quantity} * coalesce(${products.costPrice}, 0)), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...conditions, sql`${sales.status} <> 'voided'`))
      .groupBy(saleItems.productId, saleItems.productName, saleItems.sku, categories.name)
      .orderBy(desc(sql`sum(${saleItems.lineTotal} - ${saleItems.taxAmount})`))
      .limit(type === "margin" ? 250 : 100);

    const totals = rows.reduce(
      (acc, row) => ({
        revenue: acc.revenue + Number(row.revenue),
        cost: acc.cost + Number(row.cost),
      }),
      { revenue: 0, cost: 0 },
    );

    return {
      type,
      title: type === "margin" ? "Laporan Margin Kotor" : "Laporan Produk",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Pendapatan", value: money(totals.revenue) },
        { label: "Harga pokok", value: money(totals.cost) },
        { label: "Margin kotor", value: money(totals.revenue - totals.cost) },
        {
          label: "Margin %",
          value: totals.revenue > 0 ? `${((1 - totals.cost / totals.revenue) * 100).toFixed(1)}%` : "0%",
        },
      ],
      columns: [
        { key: "productName", header: "Produk" },
        { key: "sku", header: "SKU" },
        { key: "categoryName", header: "Kategori" },
        { key: "quantity", header: "Terjual" },
        { key: "revenue", header: "Pendapatan" },
        { key: "cost", header: "HPP" },
        { key: "margin", header: "Margin" },
      ],
      rows: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        revenue: Number(row.revenue),
        cost: Number(row.cost),
        margin: Number(row.revenue) - Number(row.cost),
      })),
    };
  }

  if (type === "payments") {
    const { conditions, range } = await baseSalesConditions(session, query, db);
    const rows = await db
      .select({
        method: payments.method,
        status: payments.status,
        transactions: sql<number>`count(distinct ${payments.saleId})`,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      })
      .from(payments)
      .innerJoin(sales, eq(sales.id, payments.saleId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(...conditions))
      .groupBy(payments.method, payments.status)
      .orderBy(desc(sql`sum(${payments.amount})`));

    const changeRows = await db
      .select({ change: sql<number>`coalesce(sum(${sales.changeTotal}), 0)` })
      .from(sales)
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(...conditions, sql`${sales.status} <> 'voided'`));
    const totalChange = Number(changeRows[0]?.change ?? 0);

    const normalized = rows.map((row) => {
      const amount = Number(row.amount);
      const isCash = row.method === "cash" || row.method === "tunai";
      return {
        method: row.method,
        status: row.status,
        transactions: Number(row.transactions),
        amount: isCash && row.status === "paid" ? Math.max(0, amount - totalChange) : amount,
      };
    });
    const total = normalized
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      type,
      title: "Laporan Metode Pembayaran",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Total diterima", value: money(total) },
        { label: "Kembalian", value: money(totalChange) },
      ],
      columns: [
        { key: "method", header: "Metode" },
        { key: "status", header: "Status" },
        { key: "transactions", header: "Transaksi" },
        { key: "amount", header: "Nominal" },
      ],
      rows: normalized,
    };
  }

  if (type === "inventory") {
    const scope = await resolveScope(session, query, db);
    const branchId =
      scope.requested ??
      session.membership.defaultBranchId ??
      scope.allowed[0] ??
      null;
    if (!branchId) throw new Error("No branch");
    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        categoryName: categories.name,
        quantity: sql<number>`coalesce((
          select b.quantity from inventory_balances b
          where b.branch_id = ${branchId} and b.product_id = ${products.id}
        ), 0)`,
        minimumStock: products.minimumStock,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        trackStock: products.trackStock,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(eq(products.organizationId, session.organization.id), eq(products.status, "active")),
      )
      .orderBy(asc(products.name));

    const stockValue = rows.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.costPrice),
      0,
    );
    const retailValue = rows.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.sellingPrice),
      0,
    );
    const lowStock = rows.filter(
      (row) => row.trackStock && Number(row.quantity) <= Number(row.minimumStock),
    ).length;

    return {
      type,
      title: "Laporan Stok",
      range: {
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        from: new Date().toISOString(),
        to: new Date().toISOString(),
      },
      summary: [
        { label: "Nilai stok (HPP)", value: money(stockValue) },
        { label: "Nilai retail", value: money(retailValue) },
        { label: "Produk stok rendah", value: String(lowStock) },
      ],
      columns: [
        { key: "name", header: "Produk" },
        { key: "sku", header: "SKU" },
        { key: "categoryName", header: "Kategori" },
        { key: "quantity", header: "Stok" },
        { key: "minimumStock", header: "Minimum" },
        { key: "costPrice", header: "HPP" },
        { key: "sellingPrice", header: "Harga jual" },
      ],
      rows: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        minimumStock: Number(row.minimumStock),
      })),
    };
  }

  if (type === "movements") {
    const scope = await resolveScope(session, query, db);
    const range = parsePeriod(
      { period: query.period, from: query.from, to: query.to },
      timezone,
    );
    const conditions: SQL[] = [
      eq(stockMovements.organizationId, session.organization.id),
      gte(stockMovements.createdAt, range.from),
      lte(stockMovements.createdAt, new Date(range.to.getTime() - 1)),
    ];
    conditions.push(
      branchCondition(session, scope.allowed, scope.requested, stockMovements.branchId),
    );
    const rows = await db
      .select({
        createdAt: stockMovements.createdAt,
        productName: products.name,
        sku: products.sku,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        balanceAfter: stockMovements.balanceAfter,
        branchName: branches.name,
        reason: stockMovements.reason,
        actorName: users.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .innerJoin(branches, eq(branches.id, stockMovements.branchId))
      .leftJoin(users, eq(users.id, stockMovements.createdBy))
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(2000);

    const inbound = rows
      .filter((row) => Number(row.quantity) > 0)
      .reduce((sum, row) => sum + Number(row.quantity), 0);
    const outbound = rows
      .filter((row) => Number(row.quantity) < 0)
      .reduce((sum, row) => sum + Math.abs(Number(row.quantity)), 0);

    return {
      type,
      title: "Laporan Pergerakan Stok",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Total masuk", value: String(inbound) },
        { label: "Total keluar", value: String(outbound) },
        { label: "Baris", value: String(rows.length) },
      ],
      columns: [
        { key: "createdAt", header: "Waktu" },
        { key: "branchName", header: "Cabang" },
        { key: "productName", header: "Produk" },
        { key: "sku", header: "SKU" },
        { key: "type", header: "Tipe" },
        { key: "quantity", header: "Perubahan" },
        { key: "balanceAfter", header: "Saldo" },
        { key: "reason", header: "Catatan" },
        { key: "actorName", header: "Oleh" },
      ],
      rows: rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        balanceAfter: Number(row.balanceAfter),
      })),
    };
  }

  if (type === "purchases") {
    const scope = await resolveScope(session, query, db);
    const range = parsePeriod(
      { period: query.period, from: query.from, to: query.to },
      timezone,
    );
    const conditions: SQL[] = [
      eq(purchaseOrders.organizationId, session.organization.id),
      gte(purchaseOrders.createdAt, range.from),
      lte(purchaseOrders.createdAt, new Date(range.to.getTime() - 1)),
    ];
    conditions.push(
      branchCondition(session, scope.allowed, scope.requested, purchaseOrders.branchId),
    );
    const rows = await db
      .select({
        createdAt: purchaseOrders.createdAt,
        number: purchaseOrders.number,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        total: purchaseOrders.total,
        branchName: branches.name,
        itemCount: sql<number>`(select count(*) from purchase_order_items where purchase_order_id = ${purchaseOrders.id})`,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .innerJoin(branches, eq(branches.id, purchaseOrders.branchId))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(1000);

    const total = rows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + Number(row.total), 0);
    return {
      type,
      title: "Laporan Pembelian",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Total pembelian", value: money(total) },
        { label: "Jumlah PO", value: String(rows.length) },
      ],
      columns: [
        { key: "createdAt", header: "Tanggal" },
        { key: "number", header: "Nomor" },
        { key: "supplierName", header: "Supplier" },
        { key: "branchName", header: "Cabang" },
        { key: "status", header: "Status" },
        { key: "itemCount", header: "Item" },
        { key: "total", header: "Total" },
      ],
      rows: rows.map((row) => ({ ...row, total: Number(row.total) })),
    };
  }

  if (type === "refunds") {
    const { conditions, range } = await baseSalesConditions(session, query, db);
    const refundRows = await db
      .select({
        createdAt: refunds.createdAt,
        receiptNumber: sales.receiptNumber,
        amount: refunds.amount,
        reason: refunds.reason,
        status: refunds.status,
        actorName: users.name,
      })
      .from(refunds)
      .innerJoin(sales, eq(sales.id, refunds.saleId))
      .leftJoin(users, eq(users.id, refunds.approvedBy))
      .where(
        and(
          eq(refunds.organizationId, session.organization.id),
          gte(refunds.createdAt, range.from),
          lte(refunds.createdAt, new Date(range.to.getTime() - 1)),
          branchCondition(session, (await resolveScope(session, query, db)).allowed, query.branch, sales.branchId),
        ),
      )
      .orderBy(desc(refunds.createdAt))
      .limit(1000);

    const voidRows = await db
      .select({
        updatedAt: sales.updatedAt,
        receiptNumber: sales.receiptNumber,
        grandTotal: sales.grandTotal,
        branchName: branches.name,
      })
      .from(sales)
      .innerJoin(branches, eq(branches.id, sales.branchId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(...conditions, eq(sales.status, "voided")))
      .groupBy(sales.id)
      .orderBy(desc(sales.updatedAt))
      .limit(1000);

    const refundTotal = refundRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const voidTotal = voidRows.reduce((sum, row) => sum + Number(row.grandTotal), 0);
    return {
      type,
      title: "Laporan Refund & Void",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Total refund", value: money(refundTotal) },
        { label: "Total void", value: money(voidTotal) },
        { label: "Jumlah refund", value: String(refundRows.length) },
        { label: "Jumlah void", value: String(voidRows.length) },
      ],
      columns: [
        { key: "kind", header: "Jenis" },
        { key: "createdAt", header: "Waktu" },
        { key: "receiptNumber", header: "Struk" },
        { key: "amount", header: "Nominal" },
        { key: "reason", header: "Alasan" },
        { key: "actorName", header: "Oleh" },
      ],
      rows: [
        ...refundRows.map((row) => ({ ...row, kind: "refund", amount: Number(row.amount) })),
        ...voidRows.map((row) => ({
          kind: "void",
          createdAt: row.updatedAt,
          receiptNumber: row.receiptNumber,
          amount: Number(row.grandTotal),
          reason: row.branchName,
          actorName: null,
        })),
      ],
    };
  }

  if (type === "shifts") {
    const scope = await resolveScope(session, query, db);
    const range = parsePeriod(
      { period: query.period, from: query.from, to: query.to },
      timezone,
    );
    const conditions: SQL[] = [
      eq(shifts.organizationId, session.organization.id),
      gte(shifts.openedAt, range.from),
      lte(shifts.openedAt, new Date(range.to.getTime() - 1)),
    ];
    conditions.push(branchCondition(session, scope.allowed, scope.requested, shifts.branchId));
    const rows = await db
      .select({
        openedAt: shifts.openedAt,
        closedAt: shifts.closedAt,
        branchName: branches.name,
        cashierName: users.name,
        status: shifts.status,
        openingAmount: shifts.openingAmount,
        expectedAmount: shifts.expectedAmount,
        actualAmount: shifts.actualAmount,
        difference: shifts.difference,
      })
      .from(shifts)
      .innerJoin(branches, eq(branches.id, shifts.branchId))
      .innerJoin(users, eq(users.id, shifts.cashierId))
      .where(and(...conditions))
      .orderBy(desc(shifts.openedAt))
      .limit(1000);

    const variance = rows.reduce((sum, row) => sum + Math.abs(Number(row.difference ?? 0)), 0);
    return {
      type,
      title: "Laporan Rekonsiliasi Shift",
      range: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: [
        { label: "Jumlah shift", value: String(rows.length) },
        { label: "Total selisih absolut", value: money(variance) },
      ],
      columns: [
        { key: "openedAt", header: "Dibuka" },
        { key: "closedAt", header: "Ditutup" },
        { key: "branchName", header: "Cabang" },
        { key: "cashierName", header: "Kasir" },
        { key: "status", header: "Status" },
        { key: "openingAmount", header: "Modal awal" },
        { key: "expectedAmount", header: "Seharusnya" },
        { key: "actualAmount", header: "Aktual" },
        { key: "difference", header: "Selisih" },
      ],
      rows: rows.map((row) => ({
        ...row,
        openingAmount: Number(row.openingAmount),
        expectedAmount: row.expectedAmount === null ? null : Number(row.expectedAmount),
        actualAmount: row.actualAmount === null ? null : Number(row.actualAmount),
        difference: row.difference === null ? null : Number(row.difference),
      })),
    };
  }

  throw new Error(`Unknown report type: ${type}`);
}

export const REPORT_TYPES = [
  { key: "sales", label: "Penjualan" },
  { key: "products", label: "Produk" },
  { key: "payments", label: "Pembayaran" },
  { key: "margin", label: "Margin" },
  { key: "inventory", label: "Stok" },
  { key: "movements", label: "Pergerakan" },
  { key: "purchases", label: "Pembelian" },
  { key: "refunds", label: "Refund & Void" },
  { key: "shifts", label: "Shift" },
] as const;
