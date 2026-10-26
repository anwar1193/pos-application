import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { resolveBranchId, requireBranchAccess } from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { applyStockChange } from "@/lib/inventory/ledger";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import { parseCsv, toCsv } from "@/lib/csv";
import {
  categories,
  products,
  units,
} from "@/db/schema";

const DEFAULT_PAGE_SIZE = 25;

type PageQuery = { page?: number; pageSize?: number };

function pageOf(query: PageQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function stockExpression(branchId: string) {
  return sql<number>`coalesce((
    select b.quantity from inventory_balances b
    where b.branch_id = ${branchId} and b.product_id = ${products.id}
  ), 0)`;
}

/* --------------------------------- Categories -------------------------------- */

export async function listCategories(
  session: SessionContext,
  options: { status?: string | null } = {},
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogView);
  const conditions: SQL[] = [eq(categories.organizationId, session.organization.id)];
  if (options.status && options.status !== "all") {
    conditions.push(eq(categories.status, options.status));
  }
  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.name));
}

export async function createCategory(
  session: SessionContext,
  input: { name: string; status?: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.organizationId, organizationId), eq(categories.name, input.name)))
    .limit(1);
  if (existing[0]) throw ERRORS.conflict("Kategori dengan nama tersebut sudah ada.");

  const id = createId("cat");
  const now = new Date();
  await db.insert(categories).values({
    id,
    organizationId,
    name: input.name,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.category.create",
      entityType: "category",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updateCategory(
  session: SessionContext,
  categoryId: string,
  input: { name?: string; status?: "active" | "archived" },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Kategori tidak ditemukan.");

  if (input.name && input.name !== current.name) {
    const duplicate = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.organizationId, organizationId), eq(categories.name, input.name)))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== categoryId) {
      throw ERRORS.conflict("Kategori dengan nama tersebut sudah ada.");
    }
  }

  await db
    .update(categories)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.category.update",
      entityType: "category",
      entityId: categoryId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: categoryId };
}

/** Categories are archived rather than deleted when products still reference them. */
export async function archiveCategory(
  session: SessionContext,
  categoryId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Kategori tidak ditemukan.");

  const used = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.categoryId, categoryId)))
    .limit(1);

  if (used[0]) {
    await db
      .update(categories)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(categories.id, categoryId));
  } else {
    await db.delete(categories).where(eq(categories.id, categoryId));
  }
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.category.archive",
      entityType: "category",
      entityId: categoryId,
      beforeData: current,
      metadata: { archivedInsteadOfDeleted: Boolean(used[0]) },
    },
    db,
  );
  return { id: categoryId };
}

/* ----------------------------------- Units ----------------------------------- */

export async function listUnits(session: SessionContext, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.catalogView);
  return db
    .select()
    .from(units)
    .where(eq(units.organizationId, session.organization.id))
    .orderBy(asc(units.name));
}

export async function createUnit(
  session: SessionContext,
  input: { name: string; symbol: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const existing = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.organizationId, organizationId), eq(units.name, input.name)))
    .limit(1);
  if (existing[0]) throw ERRORS.conflict("Satuan dengan nama tersebut sudah ada.");

  const id = createId("unit");
  await db.insert(units).values({
    id,
    organizationId,
    name: input.name,
    symbol: input.symbol,
    createdAt: new Date(),
  });
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.unit.create",
      entityType: "unit",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updateUnit(
  session: SessionContext,
  unitId: string,
  input: { name?: string; symbol?: string },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Satuan tidak ditemukan.");
  if (input.name && input.name !== current.name) {
    const duplicate = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.organizationId, organizationId), eq(units.name, input.name)))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== unitId) {
      throw ERRORS.conflict("Satuan dengan nama tersebut sudah ada.");
    }
  }
  await db
    .update(units)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.symbol ? { symbol: input.symbol } : {}),
    })
    .where(eq(units.id, unitId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.unit.update",
      entityType: "unit",
      entityId: unitId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: unitId };
}

export async function deleteUnit(session: SessionContext, unitId: string, db: Database = getDb()) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Satuan tidak ditemukan.");
  const used = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.unitId, unitId)))
    .limit(1);
  if (used[0]) {
    throw ERRORS.conflict("Satuan masih dipakai produk dan tidak dapat dihapus.");
  }
  await db.delete(units).where(eq(units.id, unitId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.unit.delete",
      entityType: "unit",
      entityId: unitId,
      beforeData: current,
    },
    db,
  );
  return { id: unitId };
}

/* --------------------------------- Products ---------------------------------- */

export type ProductListQuery = PageQuery & {
  q?: string;
  category?: string | null;
  status?: string;
  lowStock?: string;
  branch?: string | null;
  sort?: string;
  order?: string;
};

export async function listProducts(
  session: SessionContext,
  query: ProductListQuery,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogView);
  const organizationId = session.organization.id;
  const branchId = await resolveBranchId(session, query.branch, db);
  const { page, pageSize, offset } = pageOf(query);

  const conditions: SQL[] = [eq(products.organizationId, organizationId)];
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(
      like(products.name, term),
      like(products.sku, term),
      like(products.barcode, term),
    );
    if (search) conditions.push(search);
  }
  if (query.category) conditions.push(eq(products.categoryId, query.category));
  if (query.status && query.status !== "all") {
    conditions.push(eq(products.status, query.status));
  } else if (!query.status) {
    conditions.push(eq(products.status, "active"));
  }
  if (query.lowStock === "true") {
    conditions.push(
      sql`${products.trackStock} = 1 and coalesce((
        select b.quantity from inventory_balances b
        where b.branch_id = ${branchId} and b.product_id = ${products.id}
      ), 0) <= ${products.minimumStock}`,
    );
  }

  const stock = stockExpression(branchId);
  const order = query.order === "asc" ? asc : desc;
  const orderBy = (() => {
    switch (query.sort) {
      case "sku":
        return order(products.sku);
      case "stock":
        return query.order === "asc" ? asc(stock) : desc(stock);
      case "price":
        return order(products.sellingPrice);
      case "updated":
        return order(products.updatedAt);
      default:
        return order(products.name);
    }
  })();

  const items = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      description: products.description,
      categoryId: products.categoryId,
      categoryName: categories.name,
      unitId: products.unitId,
      unitName: units.name,
      unitSymbol: units.symbol,
      imageUrl: products.imageUrl,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
      promoPrice: products.promoPrice,
      taxRate: products.taxRate,
      trackStock: products.trackStock,
      minimumStock: products.minimumStock,
      status: products.status,
      stock,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(units, eq(units.id, products.unitId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: sql<number>`count(*)` })
    .from(products)
    .where(and(...conditions));
  const total = Number(totalRows[0]?.value ?? 0);

  return { items, total, page, pageSize, branchId };
}

export async function getProduct(
  session: SessionContext,
  productId: string,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogView);
  const organizationId = session.organization.id;
  const branchId = await resolveBranchId(session, branch, db);
  const rows = await db
    .select({
      product: products,
      categoryName: categories.name,
      unitName: units.name,
      unitSymbol: units.symbol,
      stock: stockExpression(branchId),
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(units, eq(units.id, products.unitId))
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERRORS.notFound("Produk tidak ditemukan.");
  return {
    ...row.product,
    categoryName: row.categoryName,
    unitName: row.unitName,
    unitSymbol: row.unitSymbol,
    stock: row.stock,
    branchId,
  };
}

type ProductInput = {
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  categoryId?: string | null;
  unitId?: string | null;
  imageUrl?: string | null;
  costPrice?: number;
  sellingPrice: number;
  promoPrice?: number | null;
  taxRate?: number | null;
  trackStock?: boolean;
  minimumStock?: number;
  status?: "active" | "archived";
  initialStock?: number;
};

async function assertProductReferences(
  organizationId: string,
  input: { categoryId?: string | null; unitId?: string | null },
  db: Database,
) {
  if (input.categoryId) {
    const found = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.id, input.categoryId), eq(categories.organizationId, organizationId)),
      )
      .limit(1);
    if (!found[0]) throw ERRORS.validation({ categoryId: "Kategori tidak ditemukan." });
  }
  if (input.unitId) {
    const found = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.id, input.unitId), eq(units.organizationId, organizationId)))
      .limit(1);
    if (!found[0]) throw ERRORS.validation({ unitId: "Satuan tidak ditemukan." });
  }
}

async function assertUniqueProduct(
  organizationId: string,
  input: { sku: string; barcode?: string | null },
  db: Database,
  excludeId?: string,
) {
  const skuRows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.sku, input.sku)))
    .limit(1);
  if (skuRows[0] && skuRows[0].id !== excludeId) {
    throw ERRORS.validation({ sku: "SKU sudah dipakai produk lain." });
  }
  if (input.barcode) {
    const barcodeRows = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.barcode, input.barcode)))
      .limit(1);
    if (barcodeRows[0] && barcodeRows[0].id !== excludeId) {
      throw ERRORS.validation({ barcode: "Barcode sudah dipakai produk lain." });
    }
  }
}

export async function createProduct(
  session: SessionContext,
  input: ProductInput,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  await assertProductReferences(organizationId, input, db);
  await assertUniqueProduct(organizationId, input, db);

  const branchId = await resolveBranchId(session, branch, db);
  const id = createId("prd");
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id,
      organizationId,
      name: input.name,
      sku: input.sku,
      barcode: input.barcode || null,
      description: input.description ?? null,
      categoryId: input.categoryId || null,
      unitId: input.unitId || null,
      imageUrl: input.imageUrl || null,
      costPrice: input.costPrice ?? 0,
      sellingPrice: input.sellingPrice,
      promoPrice: input.promoPrice ?? null,
      taxRate: input.taxRate ?? null,
      trackStock: input.trackStock ?? true,
      minimumStock: input.minimumStock ?? 0,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });

    if ((input.trackStock ?? true) && (input.initialStock ?? 0) > 0) {
      await applyStockChange(tx, {
        organizationId,
        branchId,
        productId: id,
        delta: input.initialStock!,
        type: "initial",
        referenceType: "product",
        referenceId: id,
        reason: "Stok awal",
        createdBy: session.user.id,
        allowNegative: true,
        productName: input.name,
        createdAt: now,
      });
    }

    await writeAuditBestEffort(
      {
        organizationId,
        actorUserId: session.user.id,
        action: "catalog.product.create",
        entityType: "product",
        entityId: id,
        branchId,
        afterData: input,
      },
      tx as unknown as Database,
    );
  });

  return { id, branchId };
}

export async function updateProduct(
  session: SessionContext,
  productId: string,
  input: Partial<ProductInput>,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Produk tidak ditemukan.");

  await assertProductReferences(organizationId, input, db);
  if (input.sku || input.barcode !== undefined) {
    await assertUniqueProduct(
      organizationId,
      { sku: input.sku ?? current.sku, barcode: input.barcode ?? current.barcode },
      db,
      productId,
    );
  }

  await db
    .update(products)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      ...(input.unitId !== undefined ? { unitId: input.unitId || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.sellingPrice !== undefined ? { sellingPrice: input.sellingPrice } : {}),
      ...(input.promoPrice !== undefined ? { promoPrice: input.promoPrice } : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
      ...(input.trackStock !== undefined ? { trackStock: input.trackStock } : {}),
      ...(input.minimumStock !== undefined ? { minimumStock: input.minimumStock } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.product.update",
      entityType: "product",
      entityId: productId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: productId };
}

/** Products referenced by transactions are archived so history keeps resolving. */
export async function archiveProduct(
  session: SessionContext,
  productId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Produk tidak ditemukan.");
  await db
    .update(products)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(products.id, productId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.product.archive",
      entityType: "product",
      entityId: productId,
      beforeData: { status: current.status },
    },
    db,
  );
  return { id: productId };
}

export async function bulkUpdateProducts(
  session: SessionContext,
  input: {
    ids: string[];
    action: "activate" | "archive" | "price_adjust";
    percentage?: number;
    applyTo?: "sellingPrice" | "costPrice";
  },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const found = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), inArray(products.id, input.ids)));
  if (found.length !== input.ids.length) {
    throw ERRORS.validation({ ids: "Sebagian produk tidak ditemukan." });
  }

  if (input.action === "activate" || input.action === "archive") {
    await db
      .update(products)
      .set({
        status: input.action === "activate" ? "active" : "archived",
        updatedAt: new Date(),
      })
      .where(and(eq(products.organizationId, organizationId), inArray(products.id, input.ids)));
  } else {
    const percentage = input.percentage ?? 0;
    if (input.applyTo === "costPrice") {
      await db
        .update(products)
        .set({
          costPrice: sql`max(0, cast(round(${products.costPrice} * (1 + ${percentage} / 100.0)) as integer))`,
          updatedAt: new Date(),
        })
        .where(and(eq(products.organizationId, organizationId), inArray(products.id, input.ids)));
    } else {
      await db
        .update(products)
        .set({
          sellingPrice: sql`max(0, cast(round(${products.sellingPrice} * (1 + ${percentage} / 100.0)) as integer))`,
          updatedAt: new Date(),
        })
        .where(and(eq(products.organizationId, organizationId), inArray(products.id, input.ids)));
    }
  }

  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.product.bulk_update",
      entityType: "product",
      entityId: null,
      afterData: input,
    },
    db,
  );
  return { updated: found.length };
}

/** Active products for the POS cart, searchable by name, SKU, or exact barcode. */
export async function searchProductsForSale(
  session: SessionContext,
  input: { branchId: string; q?: string; limit?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.saleCreate);
  await requireBranchAccess(session, input.branchId, db);
  const organizationId = session.organization.id;
  const term = input.q?.trim() ?? "";
  const conditions: SQL[] = [
    eq(products.organizationId, organizationId),
    eq(products.status, "active"),
  ];
  if (term) {
    const likeTerm = `%${term}%`;
    const search = or(
      eq(products.barcode, term),
      like(products.name, likeTerm),
      like(products.sku, likeTerm),
    );
    if (search) conditions.push(search);
  }
  const stock = stockExpression(input.branchId);
  const items = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      sellingPrice: products.sellingPrice,
      promoPrice: products.promoPrice,
      taxRate: products.taxRate,
      trackStock: products.trackStock,
      unitName: units.name,
      unitSymbol: units.symbol,
      stock,
    })
    .from(products)
    .leftJoin(units, eq(units.id, products.unitId))
    .where(and(...conditions))
    .orderBy(term ? desc(sql`${products.barcode} = ${term}`) : asc(products.name), asc(products.name))
    .limit(input.limit ?? 24);
  return items;
}

export async function exportProductsCsv(
  session: SessionContext,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogView);
  const branchId = await resolveBranchId(session, branch, db);
  const stock = stockExpression(branchId);
  const rows = await db
    .select({
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      category: categories.name,
      unit: units.name,
      costPrice: products.costPrice,
      sellingPrice: products.sellingPrice,
      promoPrice: products.promoPrice,
      taxRate: products.taxRate,
      minimumStock: products.minimumStock,
      stock,
      trackStock: products.trackStock,
      status: products.status,
      description: products.description,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(units, eq(units.id, products.unitId))
    .where(eq(products.organizationId, session.organization.id))
    .orderBy(asc(products.name));

  const csv = toCsv(
    rows.map((row) => ({
      ...row,
      trackStock: row.trackStock ? "true" : "false",
    })),
    [
      { key: "name", header: "name" },
      { key: "sku", header: "sku" },
      { key: "barcode", header: "barcode" },
      { key: "category", header: "category" },
      { key: "unit", header: "unit" },
      { key: "costPrice", header: "cost_price" },
      { key: "sellingPrice", header: "selling_price" },
      { key: "promoPrice", header: "promo_price" },
      { key: "taxRate", header: "tax_rate" },
      { key: "minimumStock", header: "minimum_stock" },
      { key: "stock", header: "stock" },
      { key: "trackStock", header: "track_stock" },
      { key: "status", header: "status" },
      { key: "description", header: "description" },
    ],
  );
  return csv;
}

export async function importProductsCsv(
  session: SessionContext,
  csvText: string,
  branch?: string | null,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.catalogManage);
  const organizationId = session.organization.id;
  const branchId = await resolveBranchId(session, branch, db);
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw ERRORS.validation({ csv: "File CSV tidak berisi data." });
  if (rows.length > 2000) throw ERRORS.validation({ csv: "Maksimal 2000 baris per impor." });

  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId));
  const unitRows = await db.select().from(units).where(eq(units.organizationId, organizationId));
  const categoryByName = new Map(categoryRows.map((row) => [row.name.toLowerCase(), row.id]));
  const unitByName = new Map(unitRows.map((row) => [row.name.toLowerCase(), row.id]));
  const existing = await db
    .select({ sku: products.sku, barcode: products.barcode })
    .from(products)
    .where(eq(products.organizationId, organizationId));
  const usedSkus = new Set(existing.map((row) => row.sku.toLowerCase()));
  const usedBarcodes = new Set(
    existing.map((row) => row.barcode?.toLowerCase()).filter((value): value is string => !!value),
  );

  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const rowNumber = index + 2;
    const name = row.name?.trim();
    const sku = row.sku?.trim();
    if (!name || !sku) {
      errors.push({ row: rowNumber, message: "Kolom name dan sku wajib diisi." });
      continue;
    }
    const sellingPrice = Number(row.selling_price ?? 0);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      errors.push({ row: rowNumber, message: "selling_price tidak valid." });
      continue;
    }

    let categoryId: string | null = null;
    if (row.category) {
      const key = row.category.toLowerCase();
      categoryId = categoryByName.get(key) ?? null;
      if (!categoryId) {
        categoryId = createId("cat");
        const now = new Date();
        await db.insert(categories).values({
          id: categoryId,
          organizationId,
          name: row.category,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        categoryByName.set(key, categoryId);
      }
    }
    let unitId: string | null = null;
    if (row.unit) {
      const key = row.unit.toLowerCase();
      unitId = unitByName.get(key) ?? null;
      if (!unitId) {
        unitId = createId("unit");
        await db.insert(units).values({
          id: unitId,
          organizationId,
          name: row.unit,
          symbol: row.unit.toLowerCase().slice(0, 10),
          createdAt: new Date(),
        });
        unitByName.set(key, unitId);
      }
    }

    let barcode = row.barcode?.trim() || null;
    if (barcode && usedBarcodes.has(barcode.toLowerCase())) barcode = null;
    const skuKey = sku.toLowerCase();
    const now = new Date();

    if (usedSkus.has(skuKey)) {
      const current = (
        await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku)))
          .limit(1)
      )[0];
      if (!current) {
        errors.push({ row: rowNumber, message: "SKU duplikat di dalam file." });
        continue;
      }
      await db
        .update(products)
        .set({
          name,
          ...(barcode && !usedBarcodes.has(barcode.toLowerCase()) ? { barcode } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(unitId ? { unitId } : {}),
          costPrice: Number(row.cost_price ?? 0) || 0,
          sellingPrice,
          promoPrice: row.promo_price ? Number(row.promo_price) : null,
          taxRate: row.tax_rate ? Number(row.tax_rate) : null,
          minimumStock: Number(row.minimum_stock ?? 0) || 0,
          trackStock: row.track_stock !== "false",
          status: row.status === "archived" ? "archived" : "active",
          description: row.description || null,
          updatedAt: now,
        })
        .where(eq(products.id, current.id));
      updated += 1;
    } else {
      const productId = createId("prd");
      await db.transaction(async (tx) => {
        await tx.insert(products).values({
          id: productId,
          organizationId,
          name,
          sku,
          barcode,
          description: row.description || null,
          categoryId,
          unitId,
          costPrice: Number(row.cost_price ?? 0) || 0,
          sellingPrice,
          promoPrice: row.promo_price ? Number(row.promo_price) : null,
          taxRate: row.tax_rate ? Number(row.tax_rate) : null,
          trackStock: row.track_stock !== "false",
          minimumStock: Number(row.minimum_stock ?? 0) || 0,
          status: row.status === "archived" ? "archived" : "active",
          createdAt: now,
          updatedAt: now,
        });
        const initialStock = Number(row.stock ?? 0) || 0;
        if (row.track_stock !== "false" && initialStock > 0) {
          await applyStockChange(tx, {
            organizationId,
            branchId,
            productId,
            delta: initialStock,
            type: "initial",
            referenceType: "product_import",
            referenceId: productId,
            reason: "Stok awal dari impor CSV",
            createdBy: session.user.id,
            allowNegative: true,
            productName: name,
            createdAt: now,
          });
        }
      });
      usedSkus.add(skuKey);
      if (barcode) usedBarcodes.add(barcode.toLowerCase());
      created += 1;
    }
  }

  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "catalog.product.import",
      entityType: "product",
      branchId,
      metadata: { created, updated, errors: errors.length },
    },
    db,
  );

  return { created, updated, errors };
}
