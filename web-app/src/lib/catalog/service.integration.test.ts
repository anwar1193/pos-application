import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { inventoryBalances, products, stockMovements } from "@/db/schema";
import { createId } from "@/lib/ids";
import {
  archiveProduct,
  createProduct,
  importProductsCsv,
  listProducts,
  updateProduct,
} from "@/lib/catalog/service";
import type { SessionContext } from "@/lib/auth/session";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  sessionFor,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

describe("catalog service", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let session: SessionContext;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    org = await seedOrganization(ctx.db);
    const owner = await seedUser(ctx.db, {
      email: "owner@demostore.id",
      password: "OwnerPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    ({ session } = await sessionFor(ctx.db, owner.userId, org.organizationId));
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("creates a product with an initial stock movement", async () => {
    const { id } = await createProduct(
      session,
      {
        name: "Biji Kopi",
        sku: "BIJI-1",
        barcode: "8991234567890",
        sellingPrice: 85_000,
        costPrice: 60_000,
        initialStock: 25,
      },
      org.branchId,
      ctx.db,
    );

    const balance = (
      await ctx.db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.branchId, org.branchId),
            eq(inventoryBalances.productId, id),
          ),
        )
        .limit(1)
    )[0]!;
    expect(balance.quantity).toBe(25);

    const movement = (
      await ctx.db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.productId, id))
        .limit(1)
    )[0]!;
    expect(movement.type).toBe("initial");
    expect(movement.quantity).toBe(25);
  });

  it("rejects duplicate SKU and barcode within the organization", async () => {
    await createProduct(
      session,
      { name: "Produk A", sku: "DUP-1", barcode: "111", sellingPrice: 1_000 },
      org.branchId,
      ctx.db,
    );

    await expect(
      createProduct(
        session,
        { name: "Produk B", sku: "DUP-1", sellingPrice: 2_000 },
        org.branchId,
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      createProduct(
        session,
        { name: "Produk C", sku: "DUP-2", barcode: "111", sellingPrice: 2_000 },
        org.branchId,
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("allows the same SKU in a different organization", async () => {
    const other = await seedOrganization(ctx.db, "Toko Lain");
    await createProduct(
      session,
      { name: "Produk A", sku: "SHARED-1", sellingPrice: 1_000 },
      org.branchId,
      ctx.db,
    );

    const now = new Date();
    await ctx.db.insert(products).values({
      id: createId("prd"),
      organizationId: other.organizationId,
      name: "Produk B",
      sku: "SHARED-1",
      sellingPrice: 2_000,
      trackStock: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const rows = await ctx.db
      .select()
      .from(products)
      .where(eq(products.sku, "SHARED-1"));
    expect(rows).toHaveLength(2);
  });

  it("archives a product so it leaves the active list", async () => {
    const { id } = await createProduct(
      session,
      { name: "Produk Arsip", sku: "ARSIP-1", sellingPrice: 1_000 },
      org.branchId,
      ctx.db,
    );

    await archiveProduct(session, id, ctx.db);

    const active = await listProducts(session, { branch: org.branchId }, ctx.db);
    expect(active.items.some((product) => product.id === id)).toBe(false);

    const all = await listProducts(session, { branch: org.branchId, status: "all" }, ctx.db);
    expect(all.items.some((product) => product.id === id)).toBe(true);
  });

  it("does not update a product from another organization", async () => {
    const other = await seedOrganization(ctx.db, "Toko Lain");
    const foreignProductId = createId("prd");
    const now = new Date();
    await ctx.db.insert(products).values({
      id: foreignProductId,
      organizationId: other.organizationId,
      name: "Produk Asing",
      sku: "ASING-1",
      sellingPrice: 5_000,
      trackStock: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      updateProduct(session, foreignProductId, { name: "Diubah" }, ctx.db),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("imports CSV rows, updates known SKUs, and reports bad rows", async () => {
    await createProduct(
      session,
      { name: "Produk Lama", sku: "IMP-1", sellingPrice: 3_000 },
      org.branchId,
      ctx.db,
    );

    const csv = [
      "name,sku,selling_price,stock",
      "Produk Baru,IMP-2,7000,15",
      "Produk Diperbarui,IMP-1,4500,0",
      ",IMP-3,1000,0",
    ].join("\n");

    const result = await importProductsCsv(session, csv, org.branchId, ctx.db);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.row).toBe(4);

    const updated = (
      await ctx.db
        .select()
        .from(products)
        .where(and(eq(products.organizationId, org.organizationId), eq(products.sku, "IMP-1")))
        .limit(1)
    )[0]!;
    expect(updated.name).toBe("Produk Diperbarui");
    expect(updated.sellingPrice).toBe(4_500);

    const created = (
      await ctx.db
        .select()
        .from(products)
        .where(and(eq(products.organizationId, org.organizationId), eq(products.sku, "IMP-2")))
        .limit(1)
    )[0]!;
    const balance = (
      await ctx.db
        .select()
        .from(inventoryBalances)
        .where(eq(inventoryBalances.productId, created.id))
        .limit(1)
    )[0]!;
    expect(balance.quantity).toBe(15);
  });
});
