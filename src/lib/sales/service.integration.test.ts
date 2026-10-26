import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  inventoryBalances,
  paymentMethods,
  products,
  refunds,
  saleItems,
  sales,
  stockMovements,
} from "@/db/schema";
import { createId } from "@/lib/ids";
import { createProduct } from "@/lib/catalog/service";
import { createSale, refundSale, voidSale } from "@/lib/sales/service";
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

describe("sales service", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let session: SessionContext;
  let productId: string;

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

    const now = new Date();
    await ctx.db.insert(paymentMethods).values([
      {
        id: createId("pm"),
        organizationId: org.organizationId,
        code: "cash",
        name: "Tunai",
        isActive: true,
        sortOrder: 1,
        createdAt: now,
      },
      {
        id: createId("pm"),
        organizationId: org.organizationId,
        code: "qris",
        name: "QRIS",
        isActive: true,
        sortOrder: 2,
        createdAt: now,
      },
    ]);

    const product = await createProduct(
      session,
      { name: "Kopi Susu", sku: "KOPI-1", sellingPrice: 10_000, initialStock: 10 },
      org.branchId,
      ctx.db,
    );
    productId = product.id;
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function stockOf(branchId = org.branchId, id = productId) {
    const row = (
      await ctx.db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.branchId, branchId),
            eq(inventoryBalances.productId, id),
          ),
        )
        .limit(1)
    )[0];
    return row?.quantity ?? 0;
  }

  function saleInput(overrides: Partial<Parameters<typeof createSale>[1]> = {}) {
    return {
      branchId: org.branchId,
      items: [{ productId, quantity: 3 }],
      payments: [{ method: "cash", amount: 30_000 }],
      ...overrides,
    };
  }

  it("records the sale, its payments, and an immutable stock movement", async () => {
    const result = await createSale(session, saleInput(), ctx.db);
    const sale = (
      await ctx.db.select().from(sales).where(eq(sales.id, result.saleId)).limit(1)
    )[0]!;

    expect(sale.grandTotal).toBe(30_000);
    expect(sale.paidTotal).toBe(30_000);
    expect(sale.changeTotal).toBe(0);
    expect(sale.status).toBe("completed");
    expect(await stockOf()).toBe(7);

    const movement = (
      await ctx.db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.referenceId, result.saleId),
            eq(stockMovements.type, "sale"),
          ),
        )
        .limit(1)
    )[0]!;
    expect(movement.quantity).toBe(-3);
    expect(movement.balanceAfter).toBe(7);
    expect(movement.createdBy).toBe(session.user.id);
  });

  it("calculates change when cash payment exceeds the total", async () => {
    const result = await createSale(
      session,
      saleInput({ payments: [{ method: "cash", amount: 50_000 }] }),
      ctx.db,
    );
    const sale = (
      await ctx.db.select().from(sales).where(eq(sales.id, result.saleId)).limit(1)
    )[0]!;
    expect(sale.changeTotal).toBe(20_000);
  });

  it("rejects a sale when payment does not cover the total", async () => {
    await expect(
      createSale(session, saleInput({ payments: [{ method: "cash", amount: 20_000 }] }), ctx.db),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await stockOf()).toBe(10);
    expect(await ctx.db.select().from(sales)).toHaveLength(0);
  });

  it("rejects a payment method that is not active", async () => {
    await expect(
      createSale(
        session,
        saleInput({ payments: [{ method: "transfer", amount: 30_000 }] }),
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await stockOf()).toBe(10);
  });

  it("replays the same idempotency key without creating a second sale", async () => {
    const input = saleInput({ idempotencyKey: "checkout-0001" });
    const first = await createSale(session, input, ctx.db);
    const second = await createSale(session, input, ctx.db);

    expect(second.saleId).toBe(first.saleId);
    expect(second.idempotent).toBe(true);
    expect(await ctx.db.select().from(sales)).toHaveLength(1);
    expect(await stockOf()).toBe(7);
  });

  it("refuses the same idempotency key for a different payload", async () => {
    await createSale(session, saleInput({ idempotencyKey: "checkout-0002" }), ctx.db);
    await expect(
      createSale(
        session,
        saleInput({
          idempotencyKey: "checkout-0002",
          items: [{ productId, quantity: 1 }],
          payments: [{ method: "cash", amount: 10_000 }],
        }),
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects products that belong to another organization", async () => {
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
      createSale(
        session,
        saleInput({
          items: [{ productId: foreignProductId, quantity: 1 }],
          payments: [{ method: "cash", amount: 5_000 }],
        }),
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("voids a sale, restores stock, and blocks a second void", async () => {
    const result = await createSale(session, saleInput(), ctx.db);

    const voided = await voidSale(
      session,
      result.saleId,
      { reason: "Salah input transaksi" },
      ctx.db,
    );
    expect(voided.status).toBe("voided");
    expect(await stockOf()).toBe(10);

    const sale = (
      await ctx.db.select().from(sales).where(eq(sales.id, result.saleId)).limit(1)
    )[0]!;
    expect(sale.status).toBe("voided");

    await expect(
      voidSale(session, result.saleId, { reason: "Ulangi void" }, ctx.db),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await stockOf()).toBe(10);
  });

  it("keeps stock unchanged when a void does not restore stock", async () => {
    const result = await createSale(session, saleInput(), ctx.db);
    await voidSale(
      session,
      result.saleId,
      { reason: "Barang tidak kembali", restoreStock: false },
      ctx.db,
    );
    expect(await stockOf()).toBe(7);
  });

  it("refunds partially, then fully, and refuses to over-refund", async () => {
    const result = await createSale(session, saleInput(), ctx.db);
    const item = (
      await ctx.db.select().from(saleItems).where(eq(saleItems.saleId, result.saleId)).limit(1)
    )[0]!;

    const partial = await refundSale(
      session,
      result.saleId,
      { reason: "Satu gelas rusak", items: [{ saleItemId: item.id, quantity: 1 }] },
      ctx.db,
    );
    expect(partial.amount).toBe(10_000);
    expect(await stockOf()).toBe(8);

    let sale = (
      await ctx.db.select().from(sales).where(eq(sales.id, result.saleId)).limit(1)
    )[0]!;
    expect(sale.status).toBe("partially_refunded");

    await refundSale(
      session,
      result.saleId,
      { reason: "Sisa pesanan batal", items: [{ saleItemId: item.id, quantity: 2 }] },
      ctx.db,
    );
    expect(await stockOf()).toBe(10);

    sale = (await ctx.db.select().from(sales).where(eq(sales.id, result.saleId)).limit(1))[0]!;
    expect(sale.status).toBe("refunded");

    const approved = await ctx.db.select().from(refunds).where(eq(refunds.saleId, result.saleId));
    expect(approved).toHaveLength(2);

    await expect(
      refundSale(
        session,
        result.saleId,
        { reason: "Refund ketiga", items: [{ saleItemId: item.id, quantity: 1 }] },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await stockOf()).toBe(10);
  });

  it("does not refund a voided sale", async () => {
    const result = await createSale(session, saleInput(), ctx.db);
    const item = (
      await ctx.db.select().from(saleItems).where(eq(saleItems.saleId, result.saleId)).limit(1)
    )[0]!;
    await voidSale(session, result.saleId, { reason: "Batal transaksi" }, ctx.db);

    await expect(
      refundSale(
        session,
        result.saleId,
        { reason: "Refund setelah void", items: [{ saleItemId: item.id, quantity: 1 }] },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
