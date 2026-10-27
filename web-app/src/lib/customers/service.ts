import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { requireApiPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionContext } from "@/lib/auth/session";
import { getAllowedBranchIds } from "@/lib/branches/service";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { ERRORS } from "@/lib/http/errors";
import { createId } from "@/lib/ids";
import { customers, sales, suppliers } from "@/db/schema";

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/* --------------------------------- Customers -------------------------------- */

export async function listCustomers(
  session: SessionContext,
  query: { q?: string; status?: string; page?: number; pageSize?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.customerView);
  const organizationId = session.organization.id;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(customers.organizationId, organizationId)];
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(
      like(customers.name, term),
      like(customers.phone, term),
      like(customers.email, term),
    );
    if (search) conditions.push(search);
  }
  if (query.status && query.status !== "all") {
    conditions.push(eq(customers.status, query.status));
  } else if (!query.status) {
    conditions.push(eq(customers.status, "active"));
  }

  const items = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      notes: customers.notes,
      status: customers.status,
      createdAt: customers.createdAt,
      transactionCount: sql<number>`coalesce((
        select count(*) from sales s
        where s.customer_id = ${customers.id} and s.status <> 'voided'
      ), 0)`,
      totalSpent: sql<number>`coalesce((
        select sum(s.grand_total) from sales s
        where s.customer_id = ${customers.id} and s.status <> 'voided'
      ), 0)`,
      lastPurchaseAt: sql<number | null>`(
        select max(s.sold_at) from sales s
        where s.customer_id = ${customers.id} and s.status <> 'voided'
      )`,
    })
    .from(customers)
    .where(and(...conditions))
    .orderBy(asc(customers.name))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(customers)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

export async function searchCustomers(
  session: SessionContext,
  query: string,
  limit = 10,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.customerView);
  const term = `%${query}%`;
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, session.organization.id),
        eq(customers.status, "active"),
        or(like(customers.name, term), like(customers.phone, term), like(customers.email, term))!,
      ),
    )
    .orderBy(asc(customers.name))
    .limit(limit);
}

export async function getCustomer(
  session: SessionContext,
  customerId: string,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.customerView);
  const organizationId = session.organization.id;
  const customer = (
    await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!customer) throw ERRORS.notFound("Pelanggan tidak ditemukan.");

  const allowed = await getAllowedBranchIds(session, db);
  const history = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      status: sales.status,
      grandTotal: sales.grandTotal,
      soldAt: sales.soldAt,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        eq(sales.customerId, customerId),
        allowed.length === 0
          ? sql`1 = 0`
          : sql`${sales.branchId} in (${sql.join(
              allowed.map((id) => sql`${id}`),
              sql`, `,
            )})`,
      ),
    )
    .orderBy(desc(sales.soldAt))
    .limit(50);

  const totals = await db
    .select({
      transactionCount: sql<number>`count(case when ${sales.status} <> 'voided' then 1 end)`,
      totalSpent: sql<number>`coalesce(sum(case when ${sales.status} <> 'voided' then ${sales.grandTotal} else 0 end), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.customerId, customerId)));

  return {
    ...customer,
    history,
    transactionCount: Number(totals[0]?.transactionCount ?? 0),
    totalSpent: Number(totals[0]?.totalSpent ?? 0),
  };
}

type CustomerInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: "active" | "archived";
};

export async function createCustomer(
  session: SessionContext,
  input: CustomerInput,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.customerManage);
  const id = createId("cust");
  const now = new Date();
  await db.insert(customers).values({
    id,
    organizationId: session.organization.id,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    notes: input.notes || null,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditBestEffort(
    {
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      action: "customer.create",
      entityType: "customer",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updateCustomer(
  session: SessionContext,
  customerId: string,
  input: Partial<CustomerInput>,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.customerManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Pelanggan tidak ditemukan.");
  await db
    .update(customers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "customer.update",
      entityType: "customer",
      entityId: customerId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: customerId };
}

/* --------------------------------- Suppliers -------------------------------- */

export async function listSuppliers(
  session: SessionContext,
  query: { q?: string; status?: string; page?: number; pageSize?: number },
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.supplierView);
  const organizationId = session.organization.id;
  const { page, pageSize, offset } = pageOf(query);
  const conditions: SQL[] = [eq(suppliers.organizationId, organizationId)];
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(
      like(suppliers.name, term),
      like(suppliers.phone, term),
      like(suppliers.email, term),
    );
    if (search) conditions.push(search);
  }
  if (query.status && query.status !== "all") {
    conditions.push(eq(suppliers.status, query.status));
  } else if (!query.status) {
    conditions.push(eq(suppliers.status, "active"));
  }
  const items = await db
    .select()
    .from(suppliers)
    .where(and(...conditions))
    .orderBy(asc(suppliers.name))
    .limit(pageSize)
    .offset(offset);
  const totalRows = await db
    .select({ value: count() })
    .from(suppliers)
    .where(and(...conditions));
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
}

type SupplierInput = CustomerInput;

export async function createSupplier(
  session: SessionContext,
  input: SupplierInput,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.supplierManage);
  const id = createId("sup");
  const now = new Date();
  await db.insert(suppliers).values({
    id,
    organizationId: session.organization.id,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    notes: input.notes || null,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditBestEffort(
    {
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      action: "supplier.create",
      entityType: "supplier",
      entityId: id,
      afterData: input,
    },
    db,
  );
  return { id };
}

export async function updateSupplier(
  session: SessionContext,
  supplierId: string,
  input: Partial<SupplierInput>,
  db: Database = getDb(),
) {
  requireApiPermission(session, PERMISSIONS.supplierManage);
  const organizationId = session.organization.id;
  const current = (
    await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, organizationId)))
      .limit(1)
  )[0];
  if (!current) throw ERRORS.notFound("Supplier tidak ditemukan.");
  await db
    .update(suppliers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, supplierId));
  await writeAuditBestEffort(
    {
      organizationId,
      actorUserId: session.user.id,
      action: "supplier.update",
      entityType: "supplier",
      entityId: supplierId,
      beforeData: current,
      afterData: input,
    },
    db,
  );
  return { id: supplierId };
}
