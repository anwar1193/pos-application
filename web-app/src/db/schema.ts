import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull();
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull();

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("IDR"),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  phone: text("phone"),
  address: text("address"),
  receiptPrefix: text("receipt_prefix").notNull().default("POS"),
  /** Tax rate in basis points (1100 = 11%). */
  taxRate: integer("tax_rate").notNull().default(0),
  allowNegativeStock: integer("allow_negative_stock", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const branches = sqliteTable(
  "branches",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    phone: text("phone"),
    address: text("address"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("branches_org_code_unique").on(t.organizationId, t.code),
    index("branches_org_idx").on(t.organizationId),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    status: text("status").notNull().default("invited"),
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("users_status_idx").on(t.status),
    check("users_status_check", sql`${t.status} in ('invited','active','suspended','disabled')`),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: id(),
    organizationId: text("organization_id").references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("roles_org_code_unique").on(t.organizationId, t.code),
    index("roles_code_idx").on(t.code),
  ],
);

export const permissions = sqliteTable("permissions", {
  id: id(),
  code: text("code").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    defaultBranchId: text("default_branch_id").references(() => branches.id),
    status: text("status").notNull().default("invited"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("memberships_org_user_unique").on(t.organizationId, t.userId),
    index("memberships_org_status_idx").on(t.organizationId, t.status),
    index("memberships_role_idx").on(t.roleId),
    index("memberships_branch_idx").on(t.defaultBranchId),
    check("memberships_status_check", sql`${t.status} in ('invited','active','suspended')`),
  ],
);

export const memberBranches = sqliteTable(
  "member_branches",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => memberships.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
  },
  (t) => [
    primaryKey({ columns: [t.membershipId, t.branchId] }),
    index("member_branches_branch_idx").on(t.branchId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    absoluteExpiresAt: integer("absolute_expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedReason: text("revoked_reason"),
  },
  (t) => [
    index("sessions_user_revoked_idx").on(t.userId, t.revokedAt),
    index("sessions_expires_idx").on(t.expiresAt),
    index("sessions_org_idx").on(t.organizationId),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    branchId: text("branch_id").references(() => branches.id),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invitations_org_status_idx").on(t.organizationId, t.status),
    index("invitations_email_idx").on(t.organizationId, t.email),
    check("invitations_status_check", sql`${t.status} in ('pending','accepted','revoked','expired')`),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by").references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id").references(() => branches.id),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeData: text("before_data"),
    afterData: text("after_data"),
    metadata: text("metadata"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorUserId),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: id(),
    emailHash: text("email_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.emailHash, t.createdAt),
    index("login_attempts_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("categories_org_name_unique").on(t.organizationId, t.name),
    index("categories_org_status_idx").on(t.organizationId, t.status),
    check("categories_status_check", sql`${t.status} in ('active','archived')`),
  ],
);

export const units = sqliteTable(
  "units",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("units_org_name_unique").on(t.organizationId, t.name),
    index("units_org_idx").on(t.organizationId),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    description: text("description"),
    categoryId: text("category_id").references(() => categories.id),
    unitId: text("unit_id").references(() => units.id),
    imageUrl: text("image_url"),
    /** Money values are integer rupiah. */
    costPrice: integer("cost_price").notNull().default(0),
    sellingPrice: integer("selling_price").notNull().default(0),
    promoPrice: integer("promo_price"),
    /** Per-product override in basis points; null uses the organization rate. */
    taxRate: integer("tax_rate"),
    trackStock: integer("track_stock", { mode: "boolean" }).notNull().default(true),
    minimumStock: real("minimum_stock").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_org_sku_unique").on(t.organizationId, t.sku),
    uniqueIndex("products_org_barcode_unique").on(t.organizationId, t.barcode),
    index("products_org_status_idx").on(t.organizationId, t.status),
    index("products_org_category_idx").on(t.organizationId, t.categoryId),
    index("products_org_name_idx").on(t.organizationId, t.name),
    check("products_status_check", sql`${t.status} in ('active','archived')`),
    check("products_prices_check", sql`${t.costPrice} >= 0 and ${t.sellingPrice} >= 0`),
  ],
);

export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payment_methods_org_code_unique").on(t.organizationId, t.code),
    index("payment_methods_org_idx").on(t.organizationId, t.isActive),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("customers_org_name_idx").on(t.organizationId, t.name),
    index("customers_org_phone_idx").on(t.organizationId, t.phone),
    check("customers_status_check", sql`${t.status} in ('active','archived')`),
  ],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("suppliers_org_name_idx").on(t.organizationId, t.name),
    check("suppliers_status_check", sql`${t.status} in ('active','archived')`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export const inventoryBalances = sqliteTable(
  "inventory_balances",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: real("quantity").notNull().default(0),
    reservedQuantity: real("reserved_quantity").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("inventory_balances_branch_product_unique").on(t.branchId, t.productId),
    index("inventory_balances_org_product_idx").on(t.organizationId, t.productId),
    index("inventory_balances_branch_idx").on(t.branchId),
  ],
);

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    type: text("type").notNull(),
    quantity: real("quantity").notNull(),
    balanceAfter: real("balance_after").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    reason: text("reason"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_org_created_idx").on(t.organizationId, t.createdAt),
    index("stock_movements_branch_product_idx").on(t.branchId, t.productId, t.createdAt),
    index("stock_movements_reference_idx").on(t.referenceType, t.referenceId),
    check(
      "stock_movements_type_check",
      sql`${t.type} in ('initial','purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','opname','void')`,
    ),
  ],
);

export const stockOpnames = sqliteTable(
  "stock_opnames",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_opnames_org_branch_idx").on(t.organizationId, t.branchId, t.startedAt),
    check("stock_opnames_status_check", sql`${t.status} in ('draft','completed','cancelled')`),
  ],
);

export const stockOpnameItems = sqliteTable(
  "stock_opname_items",
  {
    id: id(),
    opnameId: text("opname_id")
      .notNull()
      .references(() => stockOpnames.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    systemQuantity: real("system_quantity").notNull(),
    countedQuantity: real("counted_quantity").notNull(),
    difference: real("difference").notNull(),
  },
  (t) => [
    uniqueIndex("stock_opname_items_unique").on(t.opnameId, t.productId),
    index("stock_opname_items_opname_idx").on(t.opnameId),
  ],
);

export const stockTransfers = sqliteTable(
  "stock_transfers",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    fromBranchId: text("from_branch_id")
      .notNull()
      .references(() => branches.id),
    toBranchId: text("to_branch_id")
      .notNull()
      .references(() => branches.id),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    requestedBy: text("requested_by").references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    receivedBy: text("received_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("stock_transfers_org_status_idx").on(t.organizationId, t.status),
    check(
      "stock_transfers_status_check",
      sql`${t.status} in ('draft','requested','approved','in_transit','partially_received','received','cancelled')`,
    ),
  ],
);

export const stockTransferItems = sqliteTable(
  "stock_transfer_items",
  {
    id: id(),
    transferId: text("transfer_id")
      .notNull()
      .references(() => stockTransfers.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    requestedQuantity: real("requested_quantity").notNull(),
    sentQuantity: real("sent_quantity").notNull().default(0),
    receivedQuantity: real("received_quantity").notNull().default(0),
  },
  (t) => [
    uniqueIndex("stock_transfer_items_unique").on(t.transferId, t.productId),
    index("stock_transfer_items_transfer_idx").on(t.transferId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Sales, payments, shifts                                                     */
/* -------------------------------------------------------------------------- */

export const shifts = sqliteTable(
  "shifts",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    cashierId: text("cashier_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("open"),
    openingAmount: integer("opening_amount").notNull().default(0),
    expectedAmount: integer("expected_amount"),
    actualAmount: integer("actual_amount"),
    difference: integer("difference"),
    notes: text("notes"),
    approvedBy: text("approved_by").references(() => users.id),
    openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("shifts_branch_status_idx").on(t.branchId, t.status),
    index("shifts_cashier_idx").on(t.cashierId, t.status),
    check("shifts_status_check", sql`${t.status} in ('open','closed')`),
  ],
);

export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("cash_movements_shift_idx").on(t.shiftId, t.createdAt),
    check("cash_movements_type_check", sql`${t.type} in ('in','out')`),
    check("cash_movements_amount_check", sql`${t.amount} > 0`),
  ],
);

export const sales = sqliteTable(
  "sales",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    receiptNumber: text("receipt_number").notNull(),
    customerId: text("customer_id").references(() => customers.id),
    cashierId: text("cashier_id")
      .notNull()
      .references(() => users.id),
    shiftId: text("shift_id").references(() => shifts.id),
    status: text("status").notNull().default("completed"),
    subtotal: integer("subtotal").notNull().default(0),
    discountTotal: integer("discount_total").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    grandTotal: integer("grand_total").notNull().default(0),
    paidTotal: integer("paid_total").notNull().default(0),
    changeTotal: integer("change_total").notNull().default(0),
    notes: text("notes"),
    soldAt: integer("sold_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("sales_org_receipt_unique").on(t.organizationId, t.receiptNumber),
    index("sales_org_branch_sold_idx").on(t.organizationId, t.branchId, t.soldAt),
    index("sales_org_cashier_idx").on(t.organizationId, t.cashierId, t.soldAt),
    index("sales_org_customer_idx").on(t.organizationId, t.customerId, t.soldAt),
    index("sales_shift_idx").on(t.shiftId),
    check(
      "sales_status_check",
      sql`${t.status} in ('completed','voided','partially_refunded','refunded')`,
    ),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: id(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    productId: text("product_id").references(() => products.id),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    quantity: real("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxRate: integer("tax_rate").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    lineTotal: integer("line_total").notNull(),
    trackStock: integer("track_stock", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    method: text("method").notNull(),
    status: text("status").notNull().default("paid"),
    amount: integer("amount").notNull(),
    referenceNumber: text("reference_number"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_sale_idx").on(t.saleId),
    index("payments_org_paid_idx").on(t.organizationId, t.paidAt),
    check(
      "payments_status_check",
      sql`${t.status} in ('pending','paid','failed','refunded','partially_refunded')`,
    ),
  ],
);

export const saleAdjustments = sqliteTable(
  "sale_adjustments",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    type: text("type").notNull(),
    amount: integer("amount").notNull().default(0),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("sale_adjustments_sale_idx").on(t.saleId),
    check("sale_adjustments_type_check", sql`${t.type} in ('void','refund')`),
  ],
);

export const refunds = sqliteTable(
  "refunds",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id),
    status: text("status").notNull().default("approved"),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    approvedBy: text("approved_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("refunds_sale_idx").on(t.saleId),
    index("refunds_org_created_idx").on(t.organizationId, t.createdAt),
    check("refunds_status_check", sql`${t.status} in ('pending','approved','rejected')`),
  ],
);

export const refundItems = sqliteTable(
  "refund_items",
  {
    id: id(),
    refundId: text("refund_id")
      .notNull()
      .references(() => refunds.id),
    saleItemId: text("sale_item_id")
      .notNull()
      .references(() => saleItems.id),
    quantity: real("quantity").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("refund_items_refund_idx").on(t.refundId)],
);

export const parkedSales = sqliteTable(
  "parked_sales",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    cashierId: text("cashier_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull(),
    cartPayload: text("cart_payload").notNull(),
    status: text("status").notNull().default("parked"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("parked_sales_branch_status_idx").on(t.branchId, t.status),
    check("parked_sales_status_check", sql`${t.status} in ('parked','resumed','deleted')`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Purchasing                                                                  */
/* -------------------------------------------------------------------------- */

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    number: text("number").notNull(),
    status: text("status").notNull().default("draft"),
    subtotal: integer("subtotal").notNull().default(0),
    total: integer("total").notNull().default(0),
    notes: text("notes"),
    orderedAt: integer("ordered_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("purchase_orders_org_number_unique").on(t.organizationId, t.number),
    index("purchase_orders_org_status_idx").on(t.organizationId, t.status),
    check(
      "purchase_orders_status_check",
      sql`${t.status} in ('draft','ordered','partially_received','received','cancelled')`,
    ),
  ],
);

export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: id(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: real("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
    receivedQuantity: real("received_quantity").notNull().default(0),
  },
  (t) => [
    uniqueIndex("purchase_order_items_unique").on(t.purchaseOrderId, t.productId),
    index("purchase_order_items_po_idx").on(t.purchaseOrderId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Infrastructure                                                              */
/* -------------------------------------------------------------------------- */

export const counters = sqliteTable(
  "counters",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    key: text("key").notNull(),
    value: integer("value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.key] })],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responsePayload: text("response_payload"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_org_key_unique").on(t.organizationId, t.key),
    index("idempotency_keys_expires_idx").on(t.expiresAt),
  ],
);
