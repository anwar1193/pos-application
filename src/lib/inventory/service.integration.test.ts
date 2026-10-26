import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  branches,
  inventoryBalances,
  stockMovements,
  stockOpnames,
  stockTransfers,
} from "@/db/schema";
import { createId } from "@/lib/ids";
import { createProduct } from "@/lib/catalog/service";
import {
  actOnTransfer,
  adjustStock,
  completeOpname,
  createOpname,
  createTransfer,
} from "@/lib/inventory/service";
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

describe("inventory service", () => {
  let ctx: TestContext;
  let rbac: RbacFixture;
  let org: { organizationId: string; branchId: string };
  let secondBranchId: string;
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
    secondBranchId = createId("br");
    await ctx.db.insert(branches).values({
      id: secondBranchId,
      organizationId: org.organizationId,
      name: "Cabang Kedua",
      code: "CB2",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const product = await createProduct(
      session,
      { name: "Gula Aren", sku: "GULA-1", sellingPrice: 12_000, initialStock: 10 },
      org.branchId,
      ctx.db,
    );
    productId = product.id;
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function balanceOf(branchId: string, id = productId) {
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

  it("adjusts stock and appends movements with a running balance", async () => {
    const added = await adjustStock(
      session,
      { branchId: org.branchId, productId, quantity: 5, reason: "Temuan stok" },
      ctx.db,
    );
    expect(added.balanceAfter).toBe(15);

    const removed = await adjustStock(
      session,
      { branchId: org.branchId, productId, quantity: -3, reason: "Barang rusak" },
      ctx.db,
    );
    expect(removed.balanceAfter).toBe(12);
    expect(await balanceOf(org.branchId)).toBe(12);

    const movements = await ctx.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.branchId, org.branchId),
          eq(stockMovements.type, "adjustment"),
        ),
      )
      .orderBy(stockMovements.createdAt);
    expect(movements.map((movement) => movement.balanceAfter)).toEqual([15, 12]);
    expect(movements.map((movement) => movement.quantity)).toEqual([5, -3]);
  });

  it("refuses an adjustment that would oversell the branch", async () => {
    await expect(
      adjustStock(
        session,
        { branchId: org.branchId, productId, quantity: -11, reason: "Koreksi" },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await balanceOf(org.branchId)).toBe(10);
  });

  it("rejects a zero-quantity adjustment", async () => {
    await expect(
      adjustStock(
        session,
        { branchId: org.branchId, productId, quantity: 0, reason: "Nol" },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("moves stock through the full transfer lifecycle", async () => {
    const { id } = await createTransfer(
      session,
      {
        fromBranchId: org.branchId,
        toBranchId: secondBranchId,
        items: [{ productId, requestedQuantity: 4 }],
      },
      ctx.db,
    );

    let header = (
      await ctx.db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1)
    )[0]!;
    expect(header.status).toBe("draft");

    await actOnTransfer(session, id, { action: "request" }, ctx.db);
    await actOnTransfer(session, id, { action: "approve" }, ctx.db);
    await actOnTransfer(session, id, { action: "send" }, ctx.db);

    expect(await balanceOf(org.branchId)).toBe(6);
    expect(await balanceOf(secondBranchId)).toBe(0);
    header = (
      await ctx.db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1)
    )[0]!;
    expect(header.status).toBe("in_transit");

    await actOnTransfer(
      session,
      id,
      { action: "receive", items: [{ productId, receivedQuantity: 4 }] },
      ctx.db,
    );

    expect(await balanceOf(org.branchId)).toBe(6);
    expect(await balanceOf(secondBranchId)).toBe(4);
    header = (
      await ctx.db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1)
    )[0]!;
    expect(header.status).toBe("received");
  });

  it("supports partial receipt and rejects receiving more than sent", async () => {
    const { id } = await createTransfer(
      session,
      {
        fromBranchId: org.branchId,
        toBranchId: secondBranchId,
        items: [{ productId, requestedQuantity: 5 }],
      },
      ctx.db,
    );
    await actOnTransfer(session, id, { action: "request" }, ctx.db);
    await actOnTransfer(session, id, { action: "approve" }, ctx.db);
    await actOnTransfer(session, id, { action: "send" }, ctx.db);

    await actOnTransfer(
      session,
      id,
      { action: "receive", items: [{ productId, receivedQuantity: 2 }] },
      ctx.db,
    );
    expect(await balanceOf(secondBranchId)).toBe(2);
    const partial = (
      await ctx.db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1)
    )[0]!;
    expect(partial.status).toBe("partially_received");

    await expect(
      actOnTransfer(
        session,
        id,
        { action: "receive", items: [{ productId, receivedQuantity: 4 }] },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await actOnTransfer(
      session,
      id,
      { action: "receive", items: [{ productId, receivedQuantity: 3 }] },
      ctx.db,
    );
    expect(await balanceOf(secondBranchId)).toBe(5);
    const done = (
      await ctx.db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1)
    )[0]!;
    expect(done.status).toBe("received");
  });

  it("rejects a transfer between the same branch", async () => {
    await expect(
      createTransfer(
        session,
        {
          fromBranchId: org.branchId,
          toBranchId: org.branchId,
          items: [{ productId, requestedQuantity: 1 }],
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("completes an opname and reconciles the balance", async () => {
    const { id } = await createOpname(
      session,
      {
        branchId: org.branchId,
        notes: "Hitung fisik mingguan",
        items: [{ productId, countedQuantity: 7 }],
      },
      ctx.db,
    );

    const header = (
      await ctx.db.select().from(stockOpnames).where(eq(stockOpnames.id, id)).limit(1)
    )[0]!;
    expect(header.status).toBe("draft");

    await completeOpname(session, id, { reason: "Selisih hitung" }, ctx.db);

    expect(await balanceOf(org.branchId)).toBe(7);
    const completed = (
      await ctx.db.select().from(stockOpnames).where(eq(stockOpnames.id, id)).limit(1)
    )[0]!;
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();

    await expect(completeOpname(session, id, {}, ctx.db)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects duplicate products in one opname", async () => {
    await expect(
      createOpname(
        session,
        {
          branchId: org.branchId,
          items: [
            { productId, countedQuantity: 1 },
            { productId, countedQuantity: 2 },
          ],
        },
        ctx.db,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
