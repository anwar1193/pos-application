import { and, asc, count, desc, eq, gte, like, lt, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import {
  getAllowedBranchIds,
  requireBranchAccess,
  resolveBranchId,
} from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { applyStockChange, getBalanceQuantity } from "@/lib/inventory/ledger";
import { getOrganizationConfig } from "@/lib/settings/service";
import { addDays, startOfLocalDay } from "@/lib/time/period";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import {
  branches,
  products,
  stockMovements,
  stockOpnameItems,
  stockOpnames,
  stockTransferItems,
  stockTransfers,
  users,
} from "@/db/schema";

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function stockExpression(branchId: string) {
  return sql<number>`coalesce((
    select b.quantity from inventory_balances b
    where b.branch_id = ${branchId} and b.product_id = ${products.id}
  ), 0)`;
}

/* -------------------------------- Balances ---------------------------------- */

export async function listInventory(
  session: SessionContext,
  query: {
    branch?: string | null;
    q?: string;
    lowStock?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const organizationId = session.organization.id;
  const branchId = await resolveBranchId(session, query.branch, db);
  const { page, pageSize, offset } = pageOf(query);

  const conditions: SQL[] = [
    eq(products.organizationId, organizationId),
    eq(products.status, "active"),
    eq(products.trackStock, true),
  ];
  if (query.q) {
    const search = or(like(products.name, `%${query.q}%`), like(products.sku, `%${query.q}%`));
    if (search) conditions.push(search);
  }
  if (query.lowStock === "true") {
    conditions.push(
      sql`coalesce((
        select b.quantity from inventory_balances b
        where b.branch_id = ${branchId} and b.product_id = ${products.id}
      ), 0) <= ${products.minimumStock}`,
    );
  }

  const items = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      unitName: sql<string | null>`(select name from units where id = ${products.unitId})`,
      minimumStock: products.minimumStock,
      quantity: stockExpression(branchId),
      updatedAt: sql<Date | null>`(
        select b.updated_at from inventory_balances b
        where b.branch_id = ${branchId} and b.product_id = ${products.id}
      )`,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(products)
    .where(and(...conditions));

  return { items, total: totalRows[0]?.value ?? 0, page, pageSize, branchId };
}

export async function listLowStock(
  session: SessionContext,
  branch?: string | null,
  limit = 10,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const branchId = await resolveBranchId(session, branch, db);
  return db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      minimumStock: products.minimumStock,
      quantity: stockExpression(branchId),
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, session.organization.id),
        eq(products.status, "active"),
        eq(products.trackStock, true),
        sql`coalesce((
          select b.quantity from inventory_balances b
          where b.branch_id = ${branchId} and b.product_id = ${products.id}
        ), 0) <= ${products.minimumStock}`,
      ),
    )
    .orderBy(asc(products.name))
    .limit(limit);
}

export async function listMovements(
  session: SessionContext,
  query: {
    branch?: string | null;
    product?: string | null;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const organizationId = session.organization.id;
  const timezone = session.organization.timezone;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(stockMovements.organizationId, organizationId)];

  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(eq(stockMovements.branchId, query.branch));
  } else {
    const allowed = await getAllowedBranchIds(session, db);
    conditions.push(
      allowed.length === 0 ? sql`1 = 0` : sql`${stockMovements.branchId} in (${sql.join(allowed.map((id) => sql`${id}`), sql`, `)})`,
    );
  }
  if (query.product) conditions.push(eq(stockMovements.productId, query.product));
  if (query.type && query.type !== "all") conditions.push(eq(stockMovements.type, query.type));
  if (query.from) conditions.push(gte(stockMovements.createdAt, startOfLocalDay(query.from, timezone)));
  if (query.to) {
    conditions.push(lt(stockMovements.createdAt, startOfLocalDay(addDays(query.to, 1), timezone)));
  }

  const items = await db
    .select({
      id: stockMovements.id,
      branchId: stockMovements.branchId,
      branchName: branches.name,
      productId: stockMovements.productId,
      productName: products.name,
      sku: products.sku,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      balanceAfter: stockMovements.balanceAfter,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      reason: stockMovements.reason,
      actorName: users.name,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(stockMovements)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function adjustStock(
  session: SessionContext,
  input: {
    branchId: string;
    productId: string;
    quantity: number;
    reason: string;
    type?: "adjustment" | "initial";
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryAdjust);
  await requireBranchAccess(session, input.branchId, db);
  const organizationId = session.organization.id;
  const config = await getOrganizationConfig(organizationId, db);

  const product = (
    await db
      .select()
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!product) throw ERRORS.notFound("Produk tidak ditemukan.");
  if (!product.trackStock) {
    throw ERRORS.validation({ productId: "Produk ini tidak melacak stok." });
  }
  if (input.quantity === 0) {
    throw ERRORS.validation({ quantity: "Jumlah tidak boleh nol." });
  }

  let balanceAfter = 0;
  await db.transaction(async (tx) => {
    balanceAfter = await applyStockChange(tx, {
      organizationId,
      branchId: input.branchId,
      productId: input.productId,
      delta: input.quantity,
      type: input.type ?? "adjustment",
      referenceType: "manual",
      referenceId: null,
      reason: input.reason,
      createdBy: session.user.id,
      allowNegative: config.allowNegativeStock,
      productName: product.name,
    });
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "inventory.adjust",
        entityType: "inventory_balance",
        entityId: input.productId,
        branchId: input.branchId,
        beforeData: { productId: input.productId },
        afterData: input,
        metadata: { balanceAfter },
      },
      tx as unknown as Database,
    );
  });

  return { productId: input.productId, balanceAfter };
}

/* --------------------------------- Opname ----------------------------------- */

export async function createOpname(
  session: SessionContext,
  input: {
    branchId: string;
    notes?: string | null;
    items: { productId: string; countedQuantity: number }[];
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryOpname);
  await requireBranchAccess(session, input.branchId, db);
  const organizationId = session.organization.id;

  const unique = new Set(input.items.map((item) => item.productId));
  if (unique.size !== input.items.length) {
    throw ERRORS.validation({ items: "Produk tidak boleh duplikat dalam satu opname." });
  }

  const productRows = await db
    .select({ id: products.id, name: products.name, trackStock: products.trackStock })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        sql`${products.id} in (${sql.join(input.items.map((item) => sql`${item.productId}`), sql`, `)})`,
      ),
    );
  if (productRows.length !== input.items.length) {
    throw ERRORS.validation({ items: "Sebagian produk tidak ditemukan." });
  }
  const untracked = productRows.filter((row) => !row.trackStock);
  if (untracked.length > 0) {
    throw ERRORS.validation({
      items: `Produk berikut tidak melacak stok: ${untracked.map((row) => row.name).join(", ")}`,
    });
  }

  const opnameId = createId("opn");
  const now = new Date();
  const items = [] as { productId: string; systemQuantity: number; countedQuantity: number }[];
  for (const item of input.items) {
    const systemQuantity = await getBalanceQuantity(db, input.branchId, item.productId);
    items.push({
      productId: item.productId,
      systemQuantity,
      countedQuantity: item.countedQuantity,
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(stockOpnames).values({
      id: opnameId,
      organizationId,
      branchId: input.branchId,
      status: "draft",
      notes: input.notes ?? null,
      createdBy: session.user.id,
      startedAt: now,
      completedAt: null,
      createdAt: now,
    });
    for (const item of items) {
      await tx.insert(stockOpnameItems).values({
        id: createId("opi"),
        opnameId,
        productId: item.productId,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity,
        difference: item.countedQuantity - item.systemQuantity,
      });
    }
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "inventory.opname.create",
        entityType: "stock_opname",
        entityId: opnameId,
        branchId: input.branchId,
        afterData: { notes: input.notes, itemCount: items.length },
      },
      tx as unknown as Database,
    );
  });

  return { id: opnameId };
}

export async function listOpnames(
  session: SessionContext,
  query: { branch?: string | null; page?: number; pageSize?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(stockOpnames.organizationId, session.organization.id)];
  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(eq(stockOpnames.branchId, query.branch));
  }
  const items = await db
    .select({
      id: stockOpnames.id,
      branchId: stockOpnames.branchId,
      branchName: branches.name,
      status: stockOpnames.status,
      notes: stockOpnames.notes,
      createdByName: users.name,
      startedAt: stockOpnames.startedAt,
      completedAt: stockOpnames.completedAt,
    })
    .from(stockOpnames)
    .innerJoin(branches, eq(branches.id, stockOpnames.branchId))
    .leftJoin(users, eq(users.id, stockOpnames.createdBy))
    .where(and(...conditions))
    .orderBy(desc(stockOpnames.startedAt))
    .limit(pageSize)
    .offset(offset);
  const totalRows = await db
    .select({ value: count() })
    .from(stockOpnames)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function getOpname(session: SessionContext, opnameId: string, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const header = (
    await db
      .select()
      .from(stockOpnames)
      .where(
        and(
          eq(stockOpnames.id, opnameId),
          eq(stockOpnames.organizationId, session.organization.id),
        ),
      )
      .limit(1)
  )[0];
  if (!header) throw ERRORS.notFound("Stock opname tidak ditemukan.");
  const items = await db
    .select({
      productId: stockOpnameItems.productId,
      productName: products.name,
      sku: products.sku,
      systemQuantity: stockOpnameItems.systemQuantity,
      countedQuantity: stockOpnameItems.countedQuantity,
      difference: stockOpnameItems.difference,
    })
    .from(stockOpnameItems)
    .innerJoin(products, eq(products.id, stockOpnameItems.productId))
    .where(eq(stockOpnameItems.opnameId, opnameId));
  return { ...header, items };
}

export async function completeOpname(
  session: SessionContext,
  opnameId: string,
  input: { reason?: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryOpname);
  const organizationId = session.organization.id;
  const config = await getOrganizationConfig(organizationId, db);
  const header = (
    await db
      .select()
      .from(stockOpnames)
      .where(and(eq(stockOpnames.id, opnameId), eq(stockOpnames.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!header) throw ERRORS.notFound("Stock opname tidak ditemukan.");
  if (header.status !== "draft") throw ERRORS.conflict("Stock opname ini sudah diproses.");
  await requireBranchAccess(session, header.branchId, db);

  const items = await db
    .select()
    .from(stockOpnameItems)
    .where(eq(stockOpnameItems.opnameId, opnameId));

  await db.transaction(async (tx) => {
    const fresh = (
      await tx
        .select({ status: stockOpnames.status })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, opnameId))
        .limit(1)
    )[0];
    if (!fresh || fresh.status !== "draft") {
      throw ERRORS.conflict("Stock opname ini sudah diproses.");
    }
    for (const item of items) {
      const current = await getBalanceQuantity(tx, header.branchId, item.productId);
      const delta = item.countedQuantity - current;
      if (delta !== 0) {
        await applyStockChange(tx, {
          organizationId,
          branchId: header.branchId,
          productId: item.productId,
          delta,
          type: "opname",
          referenceType: "stock_opname",
          referenceId: opnameId,
          reason: input.reason ?? header.notes ?? "Penyesuaian stock opname",
          createdBy: session.user.id,
          allowNegative: config.allowNegativeStock,
        });
      }
    }
    await tx
      .update(stockOpnames)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(stockOpnames.id, opnameId));
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "inventory.opname.complete",
        entityType: "stock_opname",
        entityId: opnameId,
        branchId: header.branchId,
        afterData: { itemCount: items.length },
      },
      tx as unknown as Database,
    );
  });

  return { id: opnameId };
}

/* -------------------------------- Transfers --------------------------------- */

export async function createTransfer(
  session: SessionContext,
  input: {
    fromBranchId: string;
    toBranchId: string;
    notes?: string | null;
    items: { productId: string; requestedQuantity: number }[];
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryTransfer);
  if (input.fromBranchId === input.toBranchId) {
    throw ERRORS.validation({ toBranchId: "Cabang asal dan tujuan harus berbeda." });
  }
  await requireBranchAccess(session, input.fromBranchId, db);
  const organizationId = session.organization.id;

  const destination = (
    await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.id, input.toBranchId),
          eq(branches.organizationId, organizationId),
          eq(branches.isActive, true),
        ),
      )
      .limit(1)
  )[0];
  if (!destination) throw ERRORS.validation({ toBranchId: "Cabang tujuan tidak ditemukan." });

  const unique = new Set(input.items.map((item) => item.productId));
  if (unique.size !== input.items.length) {
    throw ERRORS.validation({ items: "Produk tidak boleh duplikat." });
  }
  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        sql`${products.id} in (${sql.join(input.items.map((item) => sql`${item.productId}`), sql`, `)})`,
      ),
    );
  if (productRows.length !== input.items.length) {
    throw ERRORS.validation({ items: "Sebagian produk tidak ditemukan." });
  }

  const transferId = createId("trf");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(stockTransfers).values({
      id: transferId,
      organizationId,
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      status: "draft",
      notes: input.notes ?? null,
      requestedBy: session.user.id,
      createdAt: now,
      updatedAt: now,
    });
    for (const item of input.items) {
      await tx.insert(stockTransferItems).values({
        id: createId("tri"),
        transferId,
        productId: item.productId,
        requestedQuantity: item.requestedQuantity,
        sentQuantity: 0,
        receivedQuantity: 0,
      });
    }
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "inventory.transfer.create",
        entityType: "stock_transfer",
        entityId: transferId,
        branchId: input.fromBranchId,
        afterData: input,
      },
      tx as unknown as Database,
    );
  });
  return { id: transferId };
}

export async function listTransfers(
  session: SessionContext,
  query: { branch?: string | null; page?: number; pageSize?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(stockTransfers.organizationId, session.organization.id)];
  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(
      or(
        eq(stockTransfers.fromBranchId, query.branch),
        eq(stockTransfers.toBranchId, query.branch),
      )!,
    );
  } else {
    const allowed = await getAllowedBranchIds(session, db);
    const fromList =
      allowed.length === 0
        ? sql`1 = 0`
        : sql`${stockTransfers.fromBranchId} in (${sql.join(
            allowed.map((id) => sql`${id}`),
            sql`, `,
          )})`;
    const toList =
      allowed.length === 0
        ? sql`1 = 0`
        : sql`${stockTransfers.toBranchId} in (${sql.join(
            allowed.map((id) => sql`${id}`),
            sql`, `,
          )})`;
    conditions.push(sql`(${fromList} or ${toList})`);
  }
  const items = await db
    .select({
      id: stockTransfers.id,
      fromBranchId: stockTransfers.fromBranchId,
      fromBranchName: sql<string>`(select name from branches where id = ${stockTransfers.fromBranchId})`,
      toBranchId: stockTransfers.toBranchId,
      toBranchName: sql<string>`(select name from branches where id = ${stockTransfers.toBranchId})`,
      status: stockTransfers.status,
      notes: stockTransfers.notes,
      itemCount: sql<number>`(select count(*) from stock_transfer_items where transfer_id = ${stockTransfers.id})`,
      createdAt: stockTransfers.createdAt,
    })
    .from(stockTransfers)
    .where(and(...conditions))
    .orderBy(desc(stockTransfers.createdAt))
    .limit(pageSize)
    .offset(offset);
  const totalRows = await db
    .select({ value: count() })
    .from(stockTransfers)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function getTransfer(
  session: SessionContext,
  transferId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryView);
  const header = (
    await db
      .select()
      .from(stockTransfers)
      .where(
        and(
          eq(stockTransfers.id, transferId),
          eq(stockTransfers.organizationId, session.organization.id),
        ),
      )
      .limit(1)
  )[0];
  if (!header) throw ERRORS.notFound("Transfer stok tidak ditemukan.");
  const items = await db
    .select({
      productId: stockTransferItems.productId,
      productName: products.name,
      sku: products.sku,
      requestedQuantity: stockTransferItems.requestedQuantity,
      sentQuantity: stockTransferItems.sentQuantity,
      receivedQuantity: stockTransferItems.receivedQuantity,
    })
    .from(stockTransferItems)
    .innerJoin(products, eq(products.id, stockTransferItems.productId))
    .where(eq(stockTransferItems.transferId, transferId));
  return { ...header, items };
}

export async function actOnTransfer(
  session: SessionContext,
  transferId: string,
  input: {
    action: "request" | "approve" | "send" | "receive" | "cancel";
    items?: { productId: string; receivedQuantity: number }[];
    notes?: string | null;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.inventoryTransfer);
  const organizationId = session.organization.id;
  const config = await getOrganizationConfig(organizationId, db);
  const header = (
    await db
      .select()
      .from(stockTransfers)
      .where(
        and(
          eq(stockTransfers.id, transferId),
          eq(stockTransfers.organizationId, organizationId),
        ),
      )
      .limit(1)
  )[0];
  if (!header) throw ERRORS.notFound("Transfer stok tidak ditemukan.");

  const fromAllowed = (await getAllowedBranchIds(session, db)).includes(header.fromBranchId);
  const toAllowed = (await getAllowedBranchIds(session, db)).includes(header.toBranchId);
  const items = await db
    .select()
    .from(stockTransferItems)
    .where(eq(stockTransferItems.transferId, transferId));

  const now = new Date();
  await db.transaction(async (tx) => {
    if (input.action === "request") {
      if (header.status !== "draft") throw ERRORS.conflict("Status transfer tidak dapat diajukan.");
      if (!fromAllowed) throw ERRORS.forbidden();
      await tx
        .update(stockTransfers)
        .set({ status: "requested", updatedAt: now })
        .where(eq(stockTransfers.id, transferId));
    } else if (input.action === "approve") {
      if (header.status !== "requested") throw ERRORS.conflict("Transfer belum diajukan.");
      if (!fromAllowed) throw ERRORS.forbidden();
      await tx
        .update(stockTransfers)
        .set({ status: "approved", approvedBy: session.user.id, updatedAt: now })
        .where(eq(stockTransfers.id, transferId));
    } else if (input.action === "send") {
      if (header.status !== "approved" && header.status !== "requested") {
        throw ERRORS.conflict("Transfer belum dapat dikirim.");
      }
      if (!fromAllowed) throw ERRORS.forbidden();
      for (const item of items) {
        await applyStockChange(tx, {
          organizationId,
          branchId: header.fromBranchId,
          productId: item.productId,
          delta: -item.requestedQuantity,
          type: "transfer_out",
          referenceType: "stock_transfer",
          referenceId: transferId,
          reason: input.notes ?? "Transfer stok keluar",
          createdBy: session.user.id,
          allowNegative: config.allowNegativeStock,
        });
        await tx
          .update(stockTransferItems)
          .set({ sentQuantity: item.requestedQuantity })
          .where(eq(stockTransferItems.id, item.id));
      }
      await tx
        .update(stockTransfers)
        .set({ status: "in_transit", updatedAt: now })
        .where(eq(stockTransfers.id, transferId));
    } else if (input.action === "receive") {
      if (header.status !== "in_transit" && header.status !== "partially_received") {
        throw ERRORS.conflict("Transfer belum dalam perjalanan.");
      }
      if (!toAllowed) throw ERRORS.forbidden();
      if (!input.items || input.items.length === 0) {
        throw ERRORS.validation({ items: "Isi jumlah barang yang diterima." });
      }
      const receivedByProduct = new Map(
        input.items.map((item) => [item.productId, item.receivedQuantity]),
      );
      for (const item of items) {
        const incoming = receivedByProduct.get(item.productId) ?? 0;
        const totalReceived = item.receivedQuantity + incoming;
        if (totalReceived > item.sentQuantity) {
          throw ERRORS.validation({
            items: "Jumlah diterima melebihi jumlah yang dikirim untuk salah satu produk.",
          });
        }
        if (incoming > 0) {
          await applyStockChange(tx, {
            organizationId,
            branchId: header.toBranchId,
            productId: item.productId,
            delta: incoming,
            type: "transfer_in",
            referenceType: "stock_transfer",
            referenceId: transferId,
            reason: "Transfer stok masuk",
            createdBy: session.user.id,
            allowNegative: true,
          });
        }
        await tx
          .update(stockTransferItems)
          .set({ receivedQuantity: totalReceived })
          .where(eq(stockTransferItems.id, item.id));
      }
      const finalItems = await tx
        .select({ sent: stockTransferItems.sentQuantity, received: stockTransferItems.receivedQuantity })
        .from(stockTransferItems)
        .where(eq(stockTransferItems.transferId, transferId));
      const allReceived = finalItems.every((item) => item.received >= item.sent);
      const anyReceived = finalItems.some((item) => item.received > 0);
      await tx
        .update(stockTransfers)
        .set({
          status: allReceived ? "received" : anyReceived ? "partially_received" : "in_transit",
          receivedBy: session.user.id,
          notes: input.notes ?? header.notes,
          updatedAt: now,
        })
        .where(eq(stockTransfers.id, transferId));
    } else if (input.action === "cancel") {
      if (!["draft", "requested", "approved"].includes(header.status)) {
        throw ERRORS.conflict("Transfer yang sudah dikirim tidak dapat dibatalkan.");
      }
      if (!fromAllowed) throw ERRORS.forbidden();
      await tx
        .update(stockTransfers)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(stockTransfers.id, transferId));
    }

    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: `inventory.transfer.${input.action}`,
        entityType: "stock_transfer",
        entityId: transferId,
        branchId: header.fromBranchId,
        beforeData: { status: header.status },
        afterData: input,
      },
      tx as unknown as Database,
    );
  });

  return { id: transferId };
}
