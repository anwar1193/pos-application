import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { customers, paymentMethods, sales, shifts } from "@/db/schema";
import type { SessionContext } from "@/lib/auth/session";
import { createProduct } from "@/lib/catalog/service";
import { getMobileDashboard } from "@/lib/mobile/dashboard";
import { createSale } from "@/lib/sales/service";
import { openShift } from "@/lib/shifts/service";
import { createId } from "@/lib/ids";
import {
  createTestDatabase,
  seedOrganization,
  seedRbac,
  seedUser,
  sessionFor,
  type RbacFixture,
  type TestContext,
} from "@/test/fixtures";

const PRODUCT_PRICE = 5_000;

describe("getMobileDashboard", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let cashier: SessionContext;
  let owner: SessionContext;
  let cashierId: string;
  let productId: string;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    org = await seedOrganization(ctx.db);

    const ownerUser = await seedUser(ctx.db, {
      email: "owner@demostore.id",
      name: "Owner",
      password: "OwnerPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    ({ session: owner } = await sessionFor(ctx.db, ownerUser.userId, org.organizationId));

    const cashierUser = await seedUser(ctx.db, {
      email: "rani@demostore.id",
      name: "Rani",
      password: "demoKasir2026!",
      roleId: rbac.roleIds.cashier,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    cashierId = cashierUser.userId;
    ({ session: cashier } = await sessionFor(ctx.db, cashierUser.userId, org.organizationId));

    await ctx.db.insert(paymentMethods).values({
      id: createId("pm"),
      organizationId: org.organizationId,
      code: "cash",
      name: "Tunai",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
    });

    const product = await createProduct(
      owner,
      { name: "Teh Manis", sku: "TEH-1", sellingPrice: PRODUCT_PRICE, initialStock: 50 },
      org.branchId,
      ctx.db,
    );
    productId = product.id;
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function sell(quantity = 2) {
    return createSale(
      cashier,
      {
        branchId: org.branchId,
        items: [{ productId, quantity }],
        payments: [{ method: "cash", amount: PRODUCT_PRICE * quantity }],
      },
      ctx.db,
    );
  }

  it("returns today's totals, the open shift, and recent sales for a cashier", async () => {
    await openShift(cashier, { branchId: org.branchId, openingAmount: 500_000 }, ctx.db);
    const { saleId, receiptNumber } = await sell(2);

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.user.name).toBe("Rani");
    expect(data.organization.name).toBe("Demo Store");
    expect(data.branch).toEqual({ id: org.branchId, name: "Cabang Utama" });
    expect(data.dateLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(data.shift).toMatchObject({
      id: expect.any(String),
      openingAmount: 500_000,
      expectedAmount: 510_000,
      transactionCount: 1,
      grossTotal: 10_000,
      cashierName: "Rani",
      branchName: "Cabang Utama",
    });
    expect(data.shift?.openedAt).toBeInstanceOf(Date);

    expect(data.today.net).toBe(10_000);
    expect(data.today.transactions).toBe(1);
    expect(data.today.itemsSold).toBe(2);
    expect(data.today.comparison.grossPercent).toBeNull();

    expect(data.recentSales).toHaveLength(1);
    expect(data.recentSales[0]).toMatchObject({
      id: saleId,
      receiptNumber,
      customerName: null,
      grandTotal: 10_000,
      status: "completed",
    });
    expect(data.recentSales[0].soldAt).toBeInstanceOf(Date);
  });

  it("returns null shift when the cashier has no open shift", async () => {
    await sell(1);

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.shift).toBeNull();
    expect(data.today.transactions).toBe(1);
  });

  it("returns at most three recent sales, newest first", async () => {
    const saleIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const sale = await sell(1);
      saleIds.push(sale.saleId);
      await ctx.db
        .update(sales)
        .set({ soldAt: new Date(Date.now() - index * 60_000) })
        .where(eq(sales.id, sale.saleId));
    }

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.recentSales).toHaveLength(3);
    expect(data.recentSales.map((sale) => sale.id)).toEqual(
      saleIds.slice(0, 3),
    );
  });

  it("excludes voided sales from totals but keeps them in recent sales", async () => {
    const completed = await sell(1);
    const voided = await sell(1);
    await ctx.db
      .update(sales)
      .set({ status: "voided" })
      .where(eq(sales.id, voided.saleId));

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.today.net).toBe(PRODUCT_PRICE);
    expect(data.today.transactions).toBe(1);
    expect(data.today.itemsSold).toBe(1);
    expect(data.recentSales.map((sale) => sale.id)).toContain(completed.saleId);
    expect(data.recentSales.map((sale) => sale.id)).toContain(voided.saleId);
  });

  it("includes the customer name when the sale has one", async () => {
    const customerId = createId("cust");
    const now = new Date();
    await ctx.db.insert(customers).values({
      id: customerId,
      organizationId: org.organizationId,
      name: "Meja 04",
      createdAt: now,
      updatedAt: now,
    });
    await createSale(
      cashier,
      {
        branchId: org.branchId,
        customerId,
        items: [{ productId, quantity: 1 }],
        payments: [{ method: "cash", amount: PRODUCT_PRICE }],
      },
      ctx.db,
    );

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.recentSales[0].customerName).toBe("Meja 04");
  });

  it("rejects a role without shift.view and sale.view", async () => {
    const warehouse = await seedUser(ctx.db, {
      email: "gudang@demostore.id",
      name: "Gudang",
      password: "WarehousePass2026!",
      roleId: rbac.roleIds.warehouse,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    const { session } = await sessionFor(ctx.db, warehouse.userId, org.organizationId);

    await expect(getMobileDashboard(session, ctx.db)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("computes the comparison against yesterday's sales", async () => {
    const today = await sell(2);
    await ctx.db
      .update(sales)
      .set({ soldAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(sales.id, today.saleId));
    await sell(1);

    const data = await getMobileDashboard(cashier, ctx.db);

    expect(data.today.transactions).toBe(1);
    expect(data.today.comparison.grossPercent).toBe(-50);
    expect(data.today.comparison.transactionsPercent).toBe(0);
  });

  it("returns the shift for the cashier's own open shift only", async () => {
    await openShift(cashier, { branchId: org.branchId, openingAmount: 100_000 }, ctx.db);
    const other = await seedUser(ctx.db, {
      email: "kasir2@demostore.id",
      name: "Kasir Dua",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    const { session: otherSession } = await sessionFor(ctx.db, other.userId, org.organizationId);

    const data = await getMobileDashboard(otherSession, ctx.db);

    expect(data.shift).toBeNull();
    const rows = await ctx.db.select().from(shifts).where(eq(shifts.cashierId, cashierId));
    expect(rows).toHaveLength(1);
  });
});
