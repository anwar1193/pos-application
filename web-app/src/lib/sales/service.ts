import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { getAllowedBranchIds, requireBranchAccess } from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { applyStockChange } from "@/lib/inventory/ledger";
import { getOrganizationConfig } from "@/lib/settings/service";
import {
  localDateString,
  parsePeriod,
} from "@/lib/time/period";
import { allocateProportionally, effectivePrice, roundMoney, taxAmount } from "@/lib/format/money";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import {
  branches,
  cashMovements,
  counters,
  customers,
  idempotencyKeys,
  parkedSales,
  paymentMethods,
  payments,
  products,
  refundItems,
  refunds,
  saleAdjustments,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";

const CASH_METHOD_CODES = new Set(["cash", "tunai"]);

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function saleScope(allowedBranchIds: string[]): SQL {
  return allowedBranchIds.length === 0
    ? sql`1 = 0`
    : sql`${sales.branchId} in (${sql.join(
        allowedBranchIds.map((id) => sql`${id}`),
        sql`, `,
      )})`;
}

async function nextReceiptNumber(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  organizationId: string,
  prefix: string,
  timezone: string,
  now: Date,
): Promise<string> {
  await tx
    .insert(counters)
    .values({ organizationId, key: "receipt", value: 1 })
    .onConflictDoUpdate({
      target: [counters.organizationId, counters.key],
      set: { value: sql`${counters.value} + 1` },
    });
  const rows = await tx
    .select({ value: counters.value })
    .from(counters)
    .where(and(eq(counters.organizationId, organizationId), eq(counters.key, "receipt")))
    .limit(1);
  const sequence = rows[0]?.value ?? 1;
  const date = localDateString(now, timezone).replaceAll("-", "");
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9-]/g, "").toUpperCase() || "POS";
  return `${cleanPrefix}-${date}-${String(sequence).padStart(5, "0")}`;
}

async function findOpenShift(
  executor: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
  organizationId: string,
  branchId: string,
  cashierId: string,
) {
  const rows = await executor
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.branchId, branchId),
        eq(shifts.cashierId, cashierId),
        eq(shifts.status, "open"),
      ),
    )
    .orderBy(desc(shifts.openedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function recordCashOut(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: {
    organizationId: string;
    branchId: string;
    cashierId: string;
    shiftId?: string | null;
    amount: number;
    reason: string;
  },
) {
  if (input.amount <= 0) return;
  let shift = input.shiftId
    ? (
        await tx
          .select()
          .from(shifts)
          .where(and(eq(shifts.id, input.shiftId), eq(shifts.status, "open")))
          .limit(1)
      )[0]
    : null;
  if (!shift) {
    shift = await findOpenShift(tx, input.organizationId, input.branchId, input.cashierId);
  }
  if (!shift) return;
  await tx.insert(cashMovements).values({
    id: createId("cm"),
    organizationId: input.organizationId,
    shiftId: shift.id,
    type: "out",
    amount: input.amount,
    reason: input.reason,
    createdBy: input.cashierId,
    createdAt: new Date(),
  });
}

export type SaleCreateInput = {
  branchId: string;
  customerId?: string | null;
  items: { productId: string; quantity: number; unitPrice?: number; discountAmount?: number }[];
  discountAmount?: number;
  notes?: string | null;
  payments: {
    method: string;
    amount: number;
    referenceNumber?: string | null;
    status?: "pending" | "paid" | "failed";
  }[];
  idempotencyKey?: string;
};

export async function createSale(
  session: SessionContext,
  input: SaleCreateInput,
  db: Database = getDb(),
  options: { ipHash?: string | null; userAgent?: string | null } = {},
): Promise<{ saleId: string; receiptNumber: string; idempotent?: boolean }> {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  const organizationId = session.organization.id;
  await requireBranchAccess(session, input.branchId, db);
  const config = await getOrganizationConfig(organizationId, db);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");

  if (input.idempotencyKey) {
    const existing = (
      await db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.organizationId, organizationId),
            eq(idempotencyKeys.key, input.idempotencyKey),
          ),
        )
        .limit(1)
    )[0];
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw ERRORS.conflict("Kunci idempotensi sudah dipakai untuk permintaan berbeda.");
      }
      const payload = existing.responsePayload
        ? (JSON.parse(existing.responsePayload) as { saleId: string; receiptNumber: string })
        : null;
      if (payload) return { ...payload, idempotent: true };
    }
  }

  if (input.items.length === 0) throw ERRORS.validation({ items: "Keranjang masih kosong." });
  const uniqueProducts = new Set(input.items.map((item) => item.productId));
  if (uniqueProducts.size !== input.items.length) {
    throw ERRORS.validation({ items: "Produk tidak boleh duplikat dalam satu transaksi." });
  }

  const productIds = [...uniqueProducts];
  const productRows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        inArray(products.id, productIds),
      ),
    );
  if (productRows.length !== productIds.length) {
    throw ERRORS.validation({ items: "Sebagian produk tidak ditemukan." });
  }
  const productMap = new Map(productRows.map((product) => [product.id, product]));
  const archived = productRows.filter((product) => product.status !== "active");
  if (archived.length > 0) {
    throw ERRORS.validation({
      items: `Produk berikut tidak aktif: ${archived.map((product) => product.name).join(", ")}`,
    });
  }

  if (input.customerId) {
    const customer = (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(eq(customers.id, input.customerId), eq(customers.organizationId, organizationId)),
        )
        .limit(1)
    )[0];
    if (!customer) throw ERRORS.validation({ customerId: "Pelanggan tidak ditemukan." });
  }

  const methodRows = await db
    .select({ code: paymentMethods.code })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.organizationId, organizationId),
        eq(paymentMethods.isActive, true),
      ),
    );
  const activeMethods = new Set(methodRows.map((row) => row.code));
  for (const payment of input.payments) {
    if (!activeMethods.has(payment.method)) {
      throw ERRORS.validation({
        payments: `Metode pembayaran "${payment.method}" tidak aktif.`,
      });
    }
  }

  type Line = {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxRate: number;
    base: number;
    tax: number;
    lineTotal: number;
    trackStock: boolean;
  };

  const lines: Line[] = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const unitPrice =
      item.unitPrice !== undefined ? Math.max(0, Math.round(item.unitPrice)) : effectivePrice(product);
    const gross = roundMoney(unitPrice * item.quantity);
    const itemDiscount = Math.min(Math.max(0, Math.round(item.discountAmount ?? 0)), gross);
    const base = gross - itemDiscount;
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      discountAmount: itemDiscount,
      taxRate: product.taxRate ?? config.taxRate,
      base,
      tax: 0,
      lineTotal: 0,
      trackStock: product.trackStock,
    };
  });

  const baseSum = lines.reduce((sum, line) => sum + line.base, 0);
  const itemDiscountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const transactionDiscount = Math.max(0, Math.round(input.discountAmount ?? 0));
  if (transactionDiscount > baseSum) {
    throw ERRORS.validation({ discountAmount: "Diskon melebihi subtotal transaksi." });
  }

  const shares = allocateProportionally(
    transactionDiscount,
    lines.map((line) => line.base),
  );
  let taxTotal = 0;
  let grandTotal = 0;
  lines.forEach((line, index) => {
    const taxable = line.base - (shares[index] ?? 0);
    line.tax = taxAmount(taxable, line.taxRate);
    line.lineTotal = taxable + line.tax;
    taxTotal += line.tax;
    grandTotal += line.lineTotal;
  });

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountTotal = itemDiscountTotal + transactionDiscount;
  grandTotal = roundMoney(grandTotal);

  const paymentTotal = input.payments.reduce((sum, payment) => sum + Math.round(payment.amount), 0);
  if (paymentTotal < grandTotal) {
    throw ERRORS.validation({
      payments: `Pembayaran kurang ${new Intl.NumberFormat("id-ID").format(
        grandTotal - paymentTotal,
      )}.`,
    });
  }

  let cashPaid = 0;
  let nonCashPaid = 0;
  for (const payment of input.payments) {
    if ((payment.status ?? "paid") !== "paid") continue;
    if (CASH_METHOD_CODES.has(payment.method)) cashPaid += Math.round(payment.amount);
    else nonCashPaid += Math.round(payment.amount);
  }
  const requiredFromCash = Math.max(0, grandTotal - nonCashPaid);
  const changeTotal = Math.max(0, cashPaid - requiredFromCash);
  const paidTotal = input.payments
    .filter((payment) => (payment.status ?? "paid") === "paid")
    .reduce((sum, payment) => sum + Math.round(payment.amount), 0);

  const saleId = createId("sale");
  let receiptNumber = "";

  await db.transaction(async (tx) => {
    const now = new Date();
    receiptNumber = await nextReceiptNumber(
      tx,
      organizationId,
      config.receiptPrefix,
      config.timezone,
      now,
    );
    const openShift = await findOpenShift(tx, organizationId, input.branchId, session.user.id);

    await tx.insert(sales).values({
      id: saleId,
      organizationId,
      branchId: input.branchId,
      receiptNumber,
      customerId: input.customerId ?? null,
      cashierId: session.user.id,
      shiftId: openShift?.id ?? null,
      status: "completed",
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      paidTotal,
      changeTotal,
      notes: input.notes ?? null,
      soldAt: now,
      createdAt: now,
      updatedAt: now,
    });

    for (const line of lines) {
      const saleItemId = createId("sit");
      await tx.insert(saleItems).values({
        id: saleItemId,
        saleId,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        taxAmount: line.tax,
        lineTotal: line.lineTotal,
        trackStock: line.trackStock,
      });
      if (line.trackStock) {
        await applyStockChange(tx, {
          organizationId,
          branchId: input.branchId,
          productId: line.productId,
          delta: -line.quantity,
          type: "sale",
          referenceType: "sale",
          referenceId: saleId,
          reason: `Penjualan ${receiptNumber}`,
          createdBy: session.user.id,
          allowNegative: config.allowNegativeStock,
          productName: line.productName,
          createdAt: now,
        });
      }
    }

    for (const payment of input.payments) {
      await tx.insert(payments).values({
        id: createId("pay"),
        organizationId,
        saleId,
        method: payment.method,
        status: payment.status ?? "paid",
        amount: Math.round(payment.amount),
        referenceNumber: payment.referenceNumber ?? null,
        paidAt: now,
        createdBy: session.user.id,
        createdAt: now,
      });
    }

    if (input.idempotencyKey) {
      await tx.insert(idempotencyKeys).values({
        id: createId("idem"),
        organizationId,
        userId: session.user.id,
        key: input.idempotencyKey,
        requestHash,
        responsePayload: JSON.stringify({ saleId, receiptNumber }),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
      });
    }

    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "sale.create",
        entityType: "sale",
        entityId: saleId,
        branchId: input.branchId,
        afterData: {
          receiptNumber,
          grandTotal,
          paidTotal,
          itemCount: lines.length,
          payments: input.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            status: payment.status ?? "paid",
          })),
        },
        ipHash: options.ipHash ?? null,
        userAgent: options.userAgent ?? null,
      },
      tx as unknown as Database,
    );
  });

  return { saleId, receiptNumber };
}

export async function listSales(
  session: SessionContext,
  query: {
    branch?: string | null;
    q?: string;
    status?: string;
    cashier?: string | null;
    customer?: string | null;
    period?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleView);
  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(sales.organizationId, organizationId)];

  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(eq(sales.branchId, query.branch));
  } else {
    const allowed = await getAllowedBranchIds(session, db);
    conditions.push(saleScope(allowed));
  }
  if (query.status && query.status !== "all") conditions.push(eq(sales.status, query.status));
  if (query.cashier) conditions.push(eq(sales.cashierId, query.cashier));
  if (query.customer) conditions.push(eq(sales.customerId, query.customer));
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(eq(sales.receiptNumber, query.q), sql`${sales.receiptNumber} like ${term}`);
    if (search) conditions.push(search);
  }
  if (query.from || query.to || query.period) {
    const range = parsePeriod(
      { period: query.period, from: query.from, to: query.to },
      timezone,
    );
    conditions.push(gte(sales.soldAt, range.from));
    conditions.push(lte(sales.soldAt, new Date(range.to.getTime() - 1)));
  }

  const items = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      branchId: sales.branchId,
      branchName: branches.name,
      customerName: customers.name,
      cashierName: users.name,
      status: sales.status,
      subtotal: sales.subtotal,
      discountTotal: sales.discountTotal,
      taxTotal: sales.taxTotal,
      grandTotal: sales.grandTotal,
      paidTotal: sales.paidTotal,
      changeTotal: sales.changeTotal,
      soldAt: sales.soldAt,
      itemCount: sql<number>`(select count(*) from sale_items where sale_id = ${sales.id})`,
      refundedTotal: sql<number>`coalesce((
        select sum(r.amount) from refunds r
        where r.sale_id = ${sales.id} and r.status = 'approved'
      ), 0)`,
    })
    .from(sales)
    .innerJoin(branches, eq(branches.id, sales.branchId))
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .innerJoin(users, eq(users.id, sales.cashierId))
    .where(and(...conditions))
    .orderBy(desc(sales.soldAt))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(sales)
    .where(and(...conditions));
  const totals = await db
    .select({
      gross: sql<number>`coalesce(sum(case when ${sales.status} = 'voided' then 0 else ${sales.grandTotal} end), 0)`,
      transactions: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
    })
    .from(sales)
    .where(and(...conditions));

  return {
    items,
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize,
    summary: {
      gross: Number(totals[0]?.gross ?? 0),
      transactions: Number(totals[0]?.transactions ?? 0),
    },
  };
}

export type SaleDetail = Awaited<ReturnType<typeof getSale>>;

export async function getSale(
  session: SessionContext,
  saleId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleView);
  const organizationId = session.organization.id;
  const rows = await db
    .select({
      sale: sales,
      branchName: branches.name,
      branchAddress: branches.address,
      branchPhone: branches.phone,
      customerName: customers.name,
      customerPhone: customers.phone,
      cashierName: users.name,
    })
    .from(sales)
    .innerJoin(branches, eq(branches.id, sales.branchId))
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .innerJoin(users, eq(users.id, sales.cashierId))
    .where(and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERRORS.notFound("Transaksi tidak ditemukan.");
  await requireBranchAccess(session, row.sale.branchId, db);

  const items = await db
    .select({
      id: saleItems.id,
      productId: saleItems.productId,
      productName: saleItems.productName,
      sku: saleItems.sku,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      discountAmount: saleItems.discountAmount,
      taxRate: saleItems.taxRate,
      taxAmount: saleItems.taxAmount,
      lineTotal: saleItems.lineTotal,
      refundedQuantity: sql<number>`coalesce((
        select sum(ri.quantity) from refund_items ri
        inner join refunds r on r.id = ri.refund_id
        where ri.sale_item_id = ${saleItems.id} and r.status = 'approved'
      ), 0)`,
      refundedAmount: sql<number>`coalesce((
        select sum(ri.amount) from refund_items ri
        inner join refunds r on r.id = ri.refund_id
        where ri.sale_item_id = ${saleItems.id} and r.status = 'approved'
      ), 0)`,
    })
    .from(saleItems)
    .where(eq(saleItems.saleId, saleId))
    .orderBy(asc(saleItems.productName));

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.saleId, saleId))
    .orderBy(asc(payments.createdAt));

  const refundRows = await db
    .select({
      id: refunds.id,
      amount: refunds.amount,
      reason: refunds.reason,
      status: refunds.status,
      approvedByName: users.name,
      createdAt: refunds.createdAt,
    })
    .from(refunds)
    .leftJoin(users, eq(users.id, refunds.approvedBy))
    .where(eq(refunds.saleId, saleId))
    .orderBy(desc(refunds.createdAt));

  const refundedTotal = refundRows
    .filter((refund) => refund.status === "approved")
    .reduce((sum, refund) => sum + refund.amount, 0);

  return {
    ...row.sale,
    branchName: row.branchName,
    branchAddress: row.branchAddress,
    branchPhone: row.branchPhone,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    cashierName: row.cashierName,
    items,
    payments: paymentRows,
    refunds: refundRows,
    refundedTotal,
  };
}

export async function voidSale(
  session: SessionContext,
  saleId: string,
  input: { reason: string; restoreStock?: boolean },
  db: Database = getDb(),
  options: { ipHash?: string | null; userAgent?: string | null } = {},
) {
  requireApiPermission(session, PERMISSIONS.saleVoid);
  const organizationId = session.organization.id;
  const config = await getOrganizationConfig(organizationId, db);
  const sale = (
    await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!sale) throw ERRORS.notFound("Transaksi tidak ditemukan.");
  await requireBranchAccess(session, sale.branchId, db);
  if (sale.status === "voided") throw ERRORS.conflict("Transaksi sudah dibatalkan.");
  if (sale.status === "refunded" || sale.status === "partially_refunded") {
    throw ERRORS.conflict("Transaksi yang sudah direfund tidak dapat dibatalkan.");
  }

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  const restoreStock = input.restoreStock !== false;

  await db.transaction(async (tx) => {
    if (restoreStock) {
      for (const item of items) {
        if (!item.trackStock) continue;
        await applyStockChange(tx, {
          organizationId,
          branchId: sale.branchId,
          productId: item.productId!,
          delta: item.quantity,
          type: "void",
          referenceType: "sale",
          referenceId: saleId,
          reason: `Void ${sale.receiptNumber}: ${input.reason}`,
          createdBy: session.user.id,
          allowNegative: config.allowNegativeStock,
          productName: item.productName,
        });
      }
    }
    await tx
      .update(sales)
      .set({ status: "voided", updatedAt: new Date() })
      .where(eq(sales.id, saleId));
    await tx.insert(saleAdjustments).values({
      id: createId("adj"),
      organizationId,
      saleId,
      type: "void",
      amount: sale.grandTotal,
      reason: input.reason,
      createdBy: session.user.id,
      approvedBy: session.user.id,
      createdAt: new Date(),
    });
    const cashPayments = await tx
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.saleId, saleId), inArray(payments.method, [...CASH_METHOD_CODES])));
    const cashAmount = cashPayments.reduce((sum, payment) => sum + payment.amount, 0);
    await recordCashOut(tx, {
      organizationId,
      branchId: sale.branchId,
      cashierId: sale.cashierId,
      shiftId: sale.shiftId,
      amount: cashAmount,
      reason: `Void ${sale.receiptNumber}`,
    });
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "sale.void",
        entityType: "sale",
        entityId: saleId,
        branchId: sale.branchId,
        beforeData: { status: sale.status, grandTotal: sale.grandTotal },
        afterData: { reason: input.reason, restoreStock },
        ipHash: options.ipHash ?? null,
        userAgent: options.userAgent ?? null,
      },
      tx as unknown as Database,
    );
  });

  return { id: saleId, status: "voided" };
}

export async function refundSale(
  session: SessionContext,
  saleId: string,
  input: {
    reason: string;
    restoreStock?: boolean;
    items: { saleItemId: string; quantity: number }[];
  },
  db: Database = getDb(),
  options: { ipHash?: string | null; userAgent?: string | null } = {},
) {
  requireApiPermission(session, PERMISSIONS.saleRefund);
  const organizationId = session.organization.id;
  const config = await getOrganizationConfig(organizationId, db);
  const sale = (
    await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!sale) throw ERRORS.notFound("Transaksi tidak ditemukan.");
  await requireBranchAccess(session, sale.branchId, db);
  if (sale.status === "voided") throw ERRORS.conflict("Transaksi yang dibatalkan tidak dapat direfund.");

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const refundedRows = await db
    .select({
      saleItemId: refundItems.saleItemId,
      quantity: sql<number>`coalesce(sum(${refundItems.quantity}), 0)`,
    })
    .from(refundItems)
    .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
    .where(and(eq(refunds.saleId, saleId), eq(refunds.status, "approved")))
    .groupBy(refundItems.saleItemId);
  const refundedByItem = new Map(refundedRows.map((row) => [row.saleItemId, Number(row.quantity)]));

  const unique = new Set(input.items.map((item) => item.saleItemId));
  if (unique.size !== input.items.length) {
    throw ERRORS.validation({ items: "Item refund tidak boleh duplikat." });
  }

  let refundAmount = 0;
  const refundLines: {
    saleItemId: string;
    quantity: number;
    amount: number;
    item: (typeof items)[number];
  }[] = [];
  for (const requested of input.items) {
    const item = itemMap.get(requested.saleItemId);
    if (!item) throw ERRORS.validation({ items: "Item transaksi tidak ditemukan." });
    const already = refundedByItem.get(item.id) ?? 0;
    if (requested.quantity > item.quantity - already + 1e-9) {
      throw ERRORS.validation({
        items: `Jumlah refund ${item.productName} melebihi jumlah yang tersisa.`,
      });
    }
    const perUnit = item.lineTotal / item.quantity;
    const amount = roundMoney(perUnit * requested.quantity);
    refundAmount += amount;
    refundLines.push({
      saleItemId: item.id,
      quantity: requested.quantity,
      amount,
      item,
    });
  }

  const previousRefundRows = await db
    .select({ amount: refunds.amount })
    .from(refunds)
    .where(and(eq(refunds.saleId, saleId), eq(refunds.status, "approved")));
  const previousRefunded = previousRefundRows.reduce((sum, row) => sum + row.amount, 0);
  if (previousRefunded + refundAmount > sale.grandTotal) {
    throw ERRORS.validation({
      items: "Total refund melebihi nilai transaksi yang belum direfund.",
    });
  }

  const refundId = createId("ref");
  const restoreStock = input.restoreStock !== false;

  await db.transaction(async (tx) => {
    const now = new Date();
    const fresh = (
      await tx
        .select({ status: sales.status })
        .from(sales)
        .where(eq(sales.id, saleId))
        .limit(1)
    )[0];
    if (!fresh || fresh.status === "voided") {
      throw ERRORS.conflict("Transaksi yang dibatalkan tidak dapat direfund.");
    }

    await tx.insert(refunds).values({
      id: refundId,
      organizationId,
      saleId,
      status: "approved",
      amount: refundAmount,
      reason: input.reason,
      approvedBy: session.user.id,
      createdAt: now,
    });

    for (const line of refundLines) {
      await tx.insert(refundItems).values({
        id: createId("rfi"),
        refundId,
        saleItemId: line.saleItemId,
        quantity: line.quantity,
        amount: line.amount,
      });
      if (restoreStock && line.item.trackStock && line.item.productId) {
        await applyStockChange(tx, {
          organizationId,
          branchId: sale.branchId,
          productId: line.item.productId,
          delta: line.quantity,
          type: "return_in",
          referenceType: "refund",
          referenceId: refundId,
          reason: `Refund ${sale.receiptNumber}: ${input.reason}`,
          createdBy: session.user.id,
          allowNegative: config.allowNegativeStock,
          productName: line.item.productName,
          createdAt: now,
        });
      }
    }

    await tx.insert(saleAdjustments).values({
      id: createId("adj"),
      organizationId,
      saleId,
      type: "refund",
      amount: refundAmount,
      reason: input.reason,
      createdBy: session.user.id,
      approvedBy: session.user.id,
      createdAt: now,
    });

    const allRefundedRows = await tx
      .select({
        quantity: sql<number>`coalesce(sum(${refundItems.quantity}), 0)`,
        saleItemId: refundItems.saleItemId,
      })
      .from(refundItems)
      .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
      .where(and(eq(refunds.saleId, saleId), eq(refunds.status, "approved")))
      .groupBy(refundItems.saleItemId);
    const totalsByItem = new Map(
      allRefundedRows.map((row) => [row.saleItemId, Number(row.quantity)]),
    );
    const fullyRefunded = items.every(
      (item) => (totalsByItem.get(item.id) ?? 0) >= item.quantity - 1e-9,
    );

    await tx
      .update(sales)
      .set({
        status: fullyRefunded ? "refunded" : "partially_refunded",
        updatedAt: now,
      })
      .where(eq(sales.id, saleId));

    const cashPayments = await tx
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.saleId, saleId), inArray(payments.method, [...CASH_METHOD_CODES])));
    if (cashPayments.length > 0) {
      await recordCashOut(tx, {
        organizationId,
        branchId: sale.branchId,
        cashierId: sale.cashierId,
        shiftId: sale.shiftId,
        amount: refundAmount,
        reason: `Refund ${sale.receiptNumber}`,
      });
    }

    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "sale.refund",
        entityType: "sale",
        entityId: saleId,
        branchId: sale.branchId,
        beforeData: { status: sale.status, refundedTotal: previousRefunded },
        afterData: {
          refundId,
          amount: refundAmount,
          reason: input.reason,
          restoreStock,
          items: input.items,
        },
        ipHash: options.ipHash ?? null,
        userAgent: options.userAgent ?? null,
      },
      tx as unknown as Database,
    );
  });

  return { id: refundId, amount: refundAmount };
}

/* ------------------------------- Parked sales ------------------------------- */

export async function createParkedSale(
  session: SessionContext,
  input: { branchId: string; label: string; cartPayload: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  await requireBranchAccess(session, input.branchId, db);
  const id = createId("prk");
  const now = new Date();
  await db.insert(parkedSales).values({
    id,
    organizationId: session.organization.id,
    branchId: input.branchId,
    cashierId: session.user.id,
    label: input.label,
    cartPayload: input.cartPayload,
    status: "parked",
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

export async function listParkedSales(
  session: SessionContext,
  branchId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  await requireBranchAccess(session, branchId, db);
  return db
    .select()
    .from(parkedSales)
    .where(
      and(
        eq(parkedSales.organizationId, session.organization.id),
        eq(parkedSales.branchId, branchId),
        eq(parkedSales.status, "parked"),
      ),
    )
    .orderBy(desc(parkedSales.createdAt));
}

export async function deleteParkedSale(
  session: SessionContext,
  parkedId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  const parked = (
    await db
      .select()
      .from(parkedSales)
      .where(
        and(
          eq(parkedSales.id, parkedId),
          eq(parkedSales.organizationId, session.organization.id),
        ),
      )
      .limit(1)
  )[0];
  if (!parked) throw ERRORS.notFound("Keranjang tersimpan tidak ditemukan.");
  await requireBranchAccess(session, parked.branchId, db);
  await db.delete(parkedSales).where(eq(parkedSales.id, parkedId));
  return { id: parkedId };
}

/* --------------------------------- Helpers ---------------------------------- */

export async function listCashiers(session: SessionContext, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.saleView);
  return db
    .selectDistinct({ id: users.id, name: users.name })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.cashierId))
    .where(eq(sales.organizationId, session.organization.id))
    .orderBy(asc(users.name));
}
