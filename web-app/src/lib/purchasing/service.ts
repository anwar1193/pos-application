import { and, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { getAllowedBranchIds, requireBranchAccess } from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { applyStockChange } from "@/lib/inventory/ledger";
import { getOrganizationConfig } from "@/lib/settings/service";
import { localDateString } from "@/lib/time/period";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import {
  branches,
  counters,
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  users,
} from "@/db/schema";

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function nextPurchaseNumber(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  organizationId: string,
  timezone: string,
  now: Date,
): Promise<string> {
  await tx
    .insert(counters)
    .values({ organizationId, key: "purchase", value: 1 })
    .onConflictDoUpdate({
      target: [counters.organizationId, counters.key],
      set: { value: sql`${counters.value} + 1` },
    });
  const rows = await tx
    .select({ value: counters.value })
    .from(counters)
    .where(and(eq(counters.organizationId, organizationId), eq(counters.key, "purchase")))
    .limit(1);
  const sequence = rows[0]?.value ?? 1;
  return `PO-${localDateString(now, timezone).replaceAll("-", "")}-${String(sequence).padStart(5, "0")}`;
}

export async function listPurchaseOrders(
  session: SessionContext,
  query: {
    branch?: string | null;
    status?: string;
    supplier?: string | null;
    q?: string;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.purchaseView);
  const organizationId = session.organization.id;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(purchaseOrders.organizationId, organizationId)];
  if (query.branch) {
    await requireBranchAccess(session, query.branch, db);
    conditions.push(eq(purchaseOrders.branchId, query.branch));
  } else {
    const allowed = await getAllowedBranchIds(session, db);
    conditions.push(
      allowed.length === 0
        ? sql`1 = 0`
        : sql`${purchaseOrders.branchId} in (${sql.join(
            allowed.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    );
  }
  if (query.status && query.status !== "all") {
    conditions.push(eq(purchaseOrders.status, query.status));
  }
  if (query.supplier) conditions.push(eq(purchaseOrders.supplierId, query.supplier));
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(like(purchaseOrders.number, term), like(suppliers.name, term));
    if (search) conditions.push(search);
  }

  const items = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      branchId: purchaseOrders.branchId,
      branchName: branches.name,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      status: purchaseOrders.status,
      subtotal: purchaseOrders.subtotal,
      total: purchaseOrders.total,
      notes: purchaseOrders.notes,
      orderedAt: purchaseOrders.orderedAt,
      createdAt: purchaseOrders.createdAt,
      itemCount: sql<number>`(select count(*) from purchase_order_items where purchase_order_id = ${purchaseOrders.id})`,
    })
    .from(purchaseOrders)
    .innerJoin(branches, eq(branches.id, purchaseOrders.branchId))
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function getPurchaseOrder(
  session: SessionContext,
  purchaseOrderId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.purchaseView);
  const organizationId = session.organization.id;
  const header = (
    await db
      .select({
        order: purchaseOrders,
        branchName: branches.name,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
        supplierEmail: suppliers.email,
        createdByName: users.name,
      })
      .from(purchaseOrders)
      .innerJoin(branches, eq(branches.id, purchaseOrders.branchId))
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, organizationId),
        ),
      )
      .limit(1)
  )[0];
  if (!header) throw ERRORS.notFound("Purchase order tidak ditemukan.");
  await requireBranchAccess(session, header.order.branchId, db);

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      productName: products.name,
      sku: products.sku,
      quantity: purchaseOrderItems.quantity,
      unitCost: purchaseOrderItems.unitCost,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  return {
    ...header.order,
    branchName: header.branchName,
    supplierName: header.supplierName,
    supplierPhone: header.supplierPhone,
    supplierEmail: header.supplierEmail,
    createdByName: header.createdByName,
    items,
  };
}

export async function createPurchaseOrder(
  session: SessionContext,
  input: {
    branchId: string;
    supplierId: string;
    notes?: string | null;
    items: { productId: string; quantity: number; unitCost: number }[];
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.purchaseManage);
  await requireBranchAccess(session, input.branchId, db);
  const organizationId = session.organization.id;

  const supplier = (
    await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!supplier) throw ERRORS.validation({ supplierId: "Supplier tidak ditemukan." });

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
        inArray(products.id, input.items.map((item) => item.productId)),
      ),
    );
  if (productRows.length !== input.items.length) {
    throw ERRORS.validation({ items: "Sebagian produk tidak ditemukan." });
  }

  const subtotal = input.items.reduce(
    (sum, item) => sum + Math.round(item.unitCost) * item.quantity,
    0,
  );
  const id = createId("po");
  const now = new Date();

  await db.transaction(async (tx) => {
    const number = await nextPurchaseNumber(tx, organizationId, session.organization.timezone, now);
    await tx.insert(purchaseOrders).values({
      id,
      organizationId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      number,
      status: "draft",
      subtotal,
      total: subtotal,
      notes: input.notes ?? null,
      orderedAt: null,
      createdBy: session.user.id,
      createdAt: now,
      updatedAt: now,
    });
    for (const item of input.items) {
      await tx.insert(purchaseOrderItems).values({
        id: createId("poi"),
        purchaseOrderId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: Math.round(item.unitCost),
        receivedQuantity: 0,
      });
    }
    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "purchase.create",
        entityType: "purchase_order",
        entityId: id,
        branchId: input.branchId,
        afterData: { number, subtotal, itemCount: input.items.length },
      },
      tx as unknown as Database,
    );
  });

  return { id };
}

export async function actOnPurchaseOrder(
  session: SessionContext,
  purchaseOrderId: string,
  action: "order" | "cancel",
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.purchaseManage);
  const order = (
    await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, session.organization.id),
        ),
      )
      .limit(1)
  )[0];
  if (!order) throw ERRORS.notFound("Purchase order tidak ditemukan.");
  await requireBranchAccess(session, order.branchId, db);

  if (action === "order") {
    if (order.status !== "draft") throw ERRORS.conflict("Purchase order sudah diproses.");
    await db
      .update(purchaseOrders)
      .set({ status: "ordered", orderedAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId));
  } else {
    if (order.status === "received" || order.status === "partially_received") {
      throw ERRORS.conflict("Purchase order yang sudah diterima tidak dapat dibatalkan.");
    }
    await db
      .update(purchaseOrders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId));
  }
  await writeAuditBestEffort(
    {
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      action: `purchase.${action}`,
      entityType: "purchase_order",
      entityId: purchaseOrderId,
      branchId: order.branchId,
      beforeData: { status: order.status },
    },
    db,
  );
  return { id: purchaseOrderId, status: action === "order" ? "ordered" : "cancelled" };
}

export async function receivePurchaseOrder(
  session: SessionContext,
  purchaseOrderId: string,
  input: {
    items: { productId: string; receivedQuantity: number }[];
    notes?: string | null;
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.purchaseReceive);
  const organizationId = session.organization.id;
  const order = (
    await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, organizationId),
        ),
      )
      .limit(1)
  )[0];
  if (!order) throw ERRORS.notFound("Purchase order tidak ditemukan.");
  await requireBranchAccess(session, order.branchId, db);
  if (order.status !== "ordered" && order.status !== "partially_received") {
    throw ERRORS.conflict("Purchase order belum dipesan atau sudah selesai.");
  }

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  const itemMap = new Map(items.map((item) => [item.productId, item]));
  const unique = new Set(input.items.map((item) => item.productId));
  if (unique.size !== input.items.length) {
    throw ERRORS.validation({ items: "Produk tidak boleh duplikat." });
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    for (const received of input.items) {
      const item = itemMap.get(received.productId);
      if (!item) {
        throw ERRORS.validation({ items: "Produk tidak ada pada purchase order ini." });
      }
      const remaining = item.quantity - item.receivedQuantity;
      if (received.receivedQuantity > remaining + 1e-9) {
        throw ERRORS.validation({
          items: "Jumlah diterima melebihi jumlah yang dipesan.",
        });
      }
      await tx
        .update(purchaseOrderItems)
        .set({ receivedQuantity: item.receivedQuantity + received.receivedQuantity })
        .where(eq(purchaseOrderItems.id, item.id));
      await applyStockChange(tx, {
        organizationId,
        branchId: order.branchId,
        productId: received.productId,
        delta: received.receivedQuantity,
        type: "purchase",
        referenceType: "purchase_order",
        referenceId: purchaseOrderId,
        reason: `Penerimaan ${order.number}`,
        createdBy: session.user.id,
        allowNegative: true,
        createdAt: now,
      });
      await tx
        .update(products)
        .set({ costPrice: item.unitCost, updatedAt: now })
        .where(eq(products.id, received.productId));
    }

    const finalItems = await tx
      .select({
        quantity: purchaseOrderItems.quantity,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
      })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
    const allReceived = finalItems.every((item) => item.receivedQuantity >= item.quantity);
    const anyReceived = finalItems.some((item) => item.receivedQuantity > 0);
    await tx
      .update(purchaseOrders)
      .set({
        status: allReceived ? "received" : anyReceived ? "partially_received" : order.status,
        notes: input.notes ?? order.notes,
        updatedAt: now,
      })
      .where(eq(purchaseOrders.id, purchaseOrderId));

    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "purchase.receive",
        entityType: "purchase_order",
        entityId: purchaseOrderId,
        branchId: order.branchId,
        beforeData: { status: order.status },
        afterData: {
          items: input.items,
          status: allReceived ? "received" : "partially_received",
        },
      },
      tx as unknown as Database,
    );
  });

  return { id: purchaseOrderId };
}

export { getOrganizationConfig };
