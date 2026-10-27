import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cashMovements, paymentMethods, sales, shifts } from "@/db/schema";
import { createId } from "@/lib/ids";
import { createProduct } from "@/lib/catalog/service";
import { createSale } from "@/lib/sales/service";
import {
  addCashMovement,
  closeShift,
  getCurrentShift,
  openShift,
  SHIFT_DIFFERENCE_THRESHOLD,
} from "@/lib/shifts/service";
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

describe("shift service", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let cashier: SessionContext;
  let managerId: string;
  let productId: string;

  beforeEach(async () => {
    ctx = await createTestDatabase();
    rbac = await seedRbac(ctx.db);
    org = await seedOrganization(ctx.db);

    const cashierUser = await seedUser(ctx.db, {
      email: "cashier@demostore.id",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    ({ session: cashier } = await sessionFor(
      ctx.db,
      cashierUser.userId,
      org.organizationId,
    ));

    const managerUser = await seedUser(ctx.db, {
      email: "manager@demostore.id",
      password: "ManagerPass2026!",
      roleId: rbac.roleIds.manager,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    managerId = managerUser.userId;

    const ownerUser = await seedUser(ctx.db, {
      email: "owner@demostore.id",
      password: "OwnerPass2026!",
      roleId: rbac.roleIds.owner,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    const { session: ownerSession } = await sessionFor(
      ctx.db,
      ownerUser.userId,
      org.organizationId,
    );

    const now = new Date();
    await ctx.db.insert(paymentMethods).values({
      id: createId("pm"),
      organizationId: org.organizationId,
      code: "cash",
      name: "Tunai",
      isActive: true,
      sortOrder: 1,
      createdAt: now,
    });

    const product = await createProduct(
      ownerSession,
      { name: "Teh Manis", sku: "TEH-1", sellingPrice: 5_000, initialStock: 20 },
      org.branchId,
      ctx.db,
    );
    productId = product.id;
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function open(amount = 100_000) {
    return openShift(cashier, { branchId: org.branchId, openingAmount: amount }, ctx.db);
  }

  it("opens one shift per cashier per branch", async () => {
    const { id } = await open();
    const shift = (
      await ctx.db.select().from(shifts).where(eq(shifts.id, id)).limit(1)
    )[0]!;
    expect(shift.status).toBe("open");
    expect(shift.openingAmount).toBe(100_000);
    expect(shift.cashierId).toBe(cashier.user.id);

    const current = await getCurrentShift(cashier, org.branchId, ctx.db);
    expect(current?.id).toBe(id);

    await expect(open()).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("includes cash sales and cash movements in the expected amount", async () => {
    const { id } = await open(100_000);

    await createSale(
      cashier,
      {
        branchId: org.branchId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: "cash", amount: 10_000 }],
      },
      ctx.db,
    );
    await addCashMovement(
      cashier,
      id,
      { type: "in", amount: 25_000, reason: "Tambahan modal" },
      ctx.db,
    );
    await addCashMovement(
      cashier,
      id,
      { type: "out", amount: 5_000, reason: "Beli galon" },
      ctx.db,
    );

    const current = await getCurrentShift(cashier, org.branchId, ctx.db);
    expect(current?.cashSales).toBe(10_000);
    expect(current?.cashIn).toBe(25_000);
    expect(current?.cashOut).toBe(5_000);
    expect(current?.expectedAmount).toBe(130_000);

    const sale = (await ctx.db.select().from(sales).limit(1))[0]!;
    expect(sale.shiftId).toBe(id);
  });

  it("closes the shift and records the difference", async () => {
    const { id } = await open(100_000);
    const result = await closeShift(cashier, id, { actualAmount: 97_500 }, ctx.db);

    expect(result.expectedAmount).toBe(100_000);
    expect(result.difference).toBe(-2_500);
    expect(result.approvedBy).toBeNull();

    const shift = (await ctx.db.select().from(shifts).where(eq(shifts.id, id)).limit(1))[0]!;
    expect(shift.status).toBe("closed");
    expect(shift.actualAmount).toBe(97_500);
    expect(shift.difference).toBe(-2_500);

    await expect(
      closeShift(cashier, id, { actualAmount: 100_000 }, ctx.db),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires a second approver for a difference above the threshold", async () => {
    const { id } = await open(100_000);

    await expect(
      closeShift(
        cashier,
        id,
        { actualAmount: 100_000 + SHIFT_DIFFERENCE_THRESHOLD + 1 },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      closeShift(
        cashier,
        id,
        {
          actualAmount: 100_000 + SHIFT_DIFFERENCE_THRESHOLD + 1,
          approvedById: cashier.user.id,
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const result = await closeShift(
      cashier,
      id,
      {
        actualAmount: 100_000 + SHIFT_DIFFERENCE_THRESHOLD + 1,
        approvedById: managerId,
      },
      ctx.db,
    );
    expect(result.approvedBy).toBe(managerId);
    expect(result.difference).toBe(SHIFT_DIFFERENCE_THRESHOLD + 1);
  });

  it("rejects cash movements on a closed shift and by another cashier", async () => {
    const { id } = await open();
    await closeShift(cashier, id, { actualAmount: 100_000 }, ctx.db);

    await expect(
      addCashMovement(cashier, id, { type: "in", amount: 1_000, reason: "Telat" }, ctx.db),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const other = await seedUser(ctx.db, {
      email: "other@demostore.id",
      password: "OtherPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });
    const { session: otherSession } = await sessionFor(
      ctx.db,
      other.userId,
      org.organizationId,
    );
    const { id: secondShift } = await openShift(
      otherSession,
      { branchId: org.branchId, openingAmount: 0 },
      ctx.db,
    );

    await expect(
      addCashMovement(
        cashier,
        secondShift,
        { type: "in", amount: 1_000, reason: "Bukan shift saya" },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const movements = await ctx.db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, id));
    expect(movements).toHaveLength(0);
  });

  it("validates the approver role", async () => {
    const { id } = await open(0);
    const anotherCashier = await seedUser(ctx.db, {
      email: "cashier2@demostore.id",
      password: "CashierPass2026!",
      roleId: rbac.roleIds.cashier,
      organizationId: org.organizationId,
      branchId: org.branchId,
    });

    await expect(
      closeShift(
        cashier,
        id,
        {
          actualAmount: SHIFT_DIFFERENCE_THRESHOLD + 1,
          approvedById: anotherCashier.userId,
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
