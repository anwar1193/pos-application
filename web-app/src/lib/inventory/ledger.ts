import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { ERRORS } from "@/lib/http/errors";
import { inventoryBalances, stockMovements } from "@/db/schema";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Accepts either the root database or an open transaction. */
export type DbExecutor = Database | Transaction;

export type StockMovementType =
  | "initial"
  | "purchase"
  | "sale"
  | "return_in"
  | "return_out"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "opname"
  | "void";

export type StockChange = {
  organizationId: string;
  branchId: string;
  productId: string;
  /** Positive adds stock, negative removes it. */
  delta: number;
  type: StockMovementType;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  allowNegative?: boolean;
  productName?: string;
  createdAt?: Date;
};

/**
 * Applies a signed quantity change and writes the immutable movement row.
 * With `allowNegative: false`, the update itself refuses to drive a balance
 * below zero, so two concurrent deductions cannot both pass the check.
 */
export async function applyStockChange(
  executor: DbExecutor,
  change: StockChange,
): Promise<number> {
  const now = change.createdAt ?? new Date();
  const delta = Math.round(change.delta * 10_000) / 10_000;

  if (delta === 0) {
    const rows = await executor
      .select({ quantity: inventoryBalances.quantity })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.branchId, change.branchId),
          eq(inventoryBalances.productId, change.productId),
        ),
      )
      .limit(1);
    return rows[0]?.quantity ?? 0;
  }

  const conditions = [
    eq(inventoryBalances.branchId, change.branchId),
    eq(inventoryBalances.productId, change.productId),
  ];
  if (delta < 0 && !change.allowNegative) {
    conditions.push(gte(inventoryBalances.quantity, -delta));
  }

  const updated = await executor
    .update(inventoryBalances)
    .set({
      quantity: sql`${inventoryBalances.quantity} + ${delta}`,
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning({ quantity: inventoryBalances.quantity });

  let balanceAfter: number;
  if (updated[0]) {
    balanceAfter = updated[0].quantity;
  } else {
    const existing = await executor
      .select({ quantity: inventoryBalances.quantity })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.branchId, change.branchId),
          eq(inventoryBalances.productId, change.productId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw ERRORS.conflict(
        `Stok ${change.productName ?? "produk"} tidak mencukupi untuk transaksi ini.`,
      );
    }
    if (delta < 0 && !change.allowNegative) {
      throw ERRORS.conflict(
        `Stok ${change.productName ?? "produk"} belum tersedia di cabang ini.`,
      );
    }
    await executor.insert(inventoryBalances).values({
      id: createId("bal"),
      organizationId: change.organizationId,
      branchId: change.branchId,
      productId: change.productId,
      quantity: delta,
      reservedQuantity: 0,
      updatedAt: now,
    });
    balanceAfter = delta;
  }

  await executor.insert(stockMovements).values({
    id: createId("mov"),
    organizationId: change.organizationId,
    branchId: change.branchId,
    productId: change.productId,
    type: change.type,
    quantity: delta,
    balanceAfter,
    referenceType: change.referenceType ?? null,
    referenceId: change.referenceId ?? null,
    reason: change.reason ?? null,
    createdBy: change.createdBy ?? null,
    createdAt: now,
  });

  return balanceAfter;
}

export async function getBalanceQuantity(
  executor: DbExecutor,
  branchId: string,
  productId: string,
): Promise<number> {
  const rows = await executor
    .select({ quantity: inventoryBalances.quantity })
    .from(inventoryBalances)
    .where(
      and(eq(inventoryBalances.branchId, branchId), eq(inventoryBalances.productId, productId)),
    )
    .limit(1);
  return rows[0]?.quantity ?? 0;
}
