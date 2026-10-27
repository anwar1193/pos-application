import { z } from "zod";

const id = z.string().trim().min(1, "ID wajib diisi.").max(120);
const optionalId = z.string().trim().max(120).nullable().optional();
const name = z.string().trim().min(1, "Nama wajib diisi.").max(160, "Nama terlalu panjang.");
const optionalText = (max = 500) => z.string().trim().max(max).nullable().optional();
const money = z.coerce
  .number()
  .int("Nominal harus bilangan bulat.")
  .min(0, "Nominal tidak boleh negatif.")
  .max(1_000_000_000_000, "Nominal terlalu besar.");
const quantity = z.coerce
  .number()
  .finite("Jumlah tidak valid.")
  .min(0, "Jumlah tidak boleh negatif.")
  .max(1_000_000, "Jumlah terlalu besar.");
const positiveQuantity = z.coerce
  .number()
  .finite("Jumlah tidak valid.")
  .gt(0, "Jumlah harus lebih dari nol.")
  .max(1_000_000, "Jumlah terlalu besar.");
const basisPoints = z.coerce
  .number()
  .int("Tarif pajak harus bilangan bulat.")
  .min(0)
  .max(10_000, "Tarif pajak maksimal 100%.");
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const branchQuerySchema = z.object({
  branch: optionalId,
});

/* ---------------------------------- Catalog -------------------------------- */

export const categoryInputSchema = z.object({
  name,
  status: z.enum(["active", "archived"]).optional(),
});

export const unitInputSchema = z.object({
  name,
  symbol: z.string().trim().min(1, "Simbol wajib diisi.").max(20, "Simbol terlalu panjang."),
});

export const productInputSchema = z.object({
  name,
  sku: z.string().trim().min(1, "SKU wajib diisi.").max(80, "SKU terlalu panjang."),
  barcode: optionalText(80),
  description: optionalText(2000),
  categoryId: optionalId,
  unitId: optionalId,
  imageUrl: optionalText(1000),
  costPrice: money.optional(),
  sellingPrice: money,
  promoPrice: money.nullable().optional(),
  taxRate: basisPoints.nullable().optional(),
  trackStock: z.boolean().optional(),
  minimumStock: quantity.optional(),
  status: z.enum(["active", "archived"]).optional(),
  initialStock: quantity.optional(),
});

export const productListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  category: optionalId,
  status: z.enum(["active", "archived", "all"]).optional(),
  lowStock: z.enum(["true", "false"]).optional(),
  branch: optionalId,
  sort: z.enum(["name", "sku", "stock", "price", "updated"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const productBulkSchema = z.object({
  ids: z.array(id).min(1, "Pilih minimal satu produk.").max(500),
  action: z.enum(["activate", "archive", "price_adjust"]),
  /** For price_adjust: percentage change, e.g. -10 lowers selling prices by 10%. */
  percentage: z.coerce.number().min(-90).max(1000).optional(),
  applyTo: z.enum(["sellingPrice", "costPrice"]).optional(),
});

export const productImportSchema = z.object({
  csv: z.string().min(1, "File CSV kosong.").max(2_000_000, "File CSV terlalu besar."),
});

/* --------------------------------- Customers -------------------------------- */

export const customerInputSchema = z.object({
  name,
  phone: optionalText(30),
  email: z.string().trim().email("Format email tidak valid.").max(254).nullable().optional().or(z.literal("")),
  address: optionalText(1000),
  notes: optionalText(2000),
  status: z.enum(["active", "archived"]).optional(),
});

export const contactListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived", "all"]).optional(),
});

/* --------------------------------- Inventory -------------------------------- */

export const stockAdjustSchema = z.object({
  branchId: id,
  productId: id,
  /** Signed change: positive adds stock, negative removes it. */
  quantity: z.coerce
    .number()
    .finite("Jumlah tidak valid.")
    .refine((value) => value !== 0, "Jumlah tidak boleh nol.")
    .refine((value) => Math.abs(value) <= 1_000_000, "Jumlah terlalu besar."),
  reason: z.string().trim().min(3, "Alasan wajib diisi (minimal 3 karakter).").max(500),
  type: z.enum(["adjustment", "initial"]).optional(),
});

export const stockInitialSchema = z.object({
  branchId: id,
  items: z
    .array(z.object({ productId: id, quantity: quantity }))
    .min(1, "Tambahkan minimal satu produk.")
    .max(500),
  reason: z.string().trim().max(500).optional(),
});

export const inventoryQuerySchema = paginationSchema.extend({
  branch: optionalId,
  q: z.string().trim().max(120).optional(),
  lowStock: z.enum(["true", "false"]).optional(),
});

export const movementQuerySchema = paginationSchema.extend({
  branch: optionalId,
  product: optionalId,
  type: z
    .enum([
      "initial",
      "purchase",
      "sale",
      "return_in",
      "return_out",
      "transfer_in",
      "transfer_out",
      "adjustment",
      "opname",
      "void",
      "all",
    ])
    .optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const opnameCreateSchema = z.object({
  branchId: id,
  notes: optionalText(1000),
  items: z
    .array(z.object({ productId: id, countedQuantity: quantity }))
    .min(1, "Tambahkan minimal satu produk.")
    .max(1000),
});

export const opnameCompleteSchema = z.object({
  reason: z.string().trim().min(3, "Alasan wajib diisi.").max(500).optional(),
});

export const transferCreateSchema = z.object({
  fromBranchId: id,
  toBranchId: id,
  notes: optionalText(1000),
  items: z
    .array(z.object({ productId: id, requestedQuantity: positiveQuantity }))
    .min(1, "Tambahkan minimal satu produk.")
    .max(500),
});

export const transferActionSchema = z.object({
  action: z.enum(["request", "approve", "send", "receive", "cancel"]),
  items: z
    .array(z.object({ productId: id, receivedQuantity: quantity }))
    .max(500)
    .optional(),
  notes: optionalText(1000),
});

/* ----------------------------------- Sales ---------------------------------- */

export const saleItemInputSchema = z.object({
  productId: id,
  quantity: positiveQuantity,
  unitPrice: money.optional(),
  discountAmount: money.optional(),
});

export const paymentInputSchema = z.object({
  method: z.string().trim().min(1, "Metode pembayaran wajib dipilih.").max(40),
  amount: money,
  referenceNumber: optionalText(120),
  status: z.enum(["pending", "paid", "failed"]).optional(),
});

export const saleCreateSchema = z.object({
  branchId: id,
  customerId: optionalId,
  items: z.array(saleItemInputSchema).min(1, "Keranjang masih kosong.").max(200),
  discountAmount: money.optional(),
  notes: optionalText(1000),
  payments: z.array(paymentInputSchema).min(1, "Tambahkan pembayaran.").max(10),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
}).refine(
  (value) => {
    const total = value.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total > 0;
  },
  { message: "Total pembayaran harus lebih dari nol.", path: ["payments"] },
);

export const saleListQuerySchema = paginationSchema.extend({
  branch: optionalId,
  q: z.string().trim().max(120).optional(),
  status: z.enum(["completed", "voided", "partially_refunded", "refunded", "all"]).optional(),
  cashier: optionalId,
  customer: optionalId,
  period: z.enum(["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"]).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const saleVoidSchema = z.object({
  reason: z.string().trim().min(3, "Alasan pembatalan wajib diisi.").max(500),
  restoreStock: z.boolean().optional(),
});

export const saleRefundSchema = z.object({
  reason: z.string().trim().min(3, "Alasan refund wajib diisi.").max(500),
  restoreStock: z.boolean().optional(),
  items: z
    .array(z.object({ saleItemId: id, quantity: positiveQuantity }))
    .min(1, "Pilih minimal satu item untuk direfund.")
    .max(200),
});

export const parkedSaleCreateSchema = z.object({
  branchId: id,
  label: z.string().trim().min(1, "Label wajib diisi.").max(120),
  cartPayload: z.string().min(2, "Keranjang tidak valid.").max(100_000, "Keranjang terlalu besar."),
});

/* ---------------------------------- Shifts ---------------------------------- */

export const shiftOpenSchema = z.object({
  branchId: id,
  openingAmount: money,
  notes: optionalText(500),
});

export const shiftCashSchema = z.object({
  type: z.enum(["in", "out"]),
  amount: z.coerce.number().int("Nominal harus bilangan bulat.").gt(0, "Nominal harus lebih dari nol."),
  reason: z.string().trim().min(3, "Alasan wajib diisi.").max(500),
});

export const shiftCloseSchema = z.object({
  actualAmount: money,
  notes: optionalText(1000),
  approvedById: optionalId,
});

/* -------------------------------- Purchasing -------------------------------- */

export const supplierInputSchema = z.object({
  name,
  phone: optionalText(30),
  email: z.string().trim().email("Format email tidak valid.").max(254).nullable().optional().or(z.literal("")),
  address: optionalText(1000),
  notes: optionalText(2000),
  status: z.enum(["active", "archived"]).optional(),
});

export const purchaseOrderInputSchema = z.object({
  branchId: id,
  supplierId: id,
  notes: optionalText(1000),
  items: z
    .array(
      z.object({
        productId: id,
        quantity: positiveQuantity,
        unitCost: money,
      }),
    )
    .min(1, "Tambahkan minimal satu item.")
    .max(500),
});

export const purchaseActionSchema = z.object({
  action: z.enum(["order", "cancel"]),
});

export const purchaseReceiveSchema = z.object({
  items: z
    .array(z.object({ productId: id, receivedQuantity: positiveQuantity }))
    .min(1, "Tambahkan minimal satu item yang diterima.")
    .max(500),
  notes: optionalText(1000),
});

export const purchaseListQuerySchema = paginationSchema.extend({
  branch: optionalId,
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled", "all"]).optional(),
  supplier: optionalId,
  q: z.string().trim().max(120).optional(),
});

/* --------------------------------- Reports ---------------------------------- */

export const reportQuerySchema = z.object({
  type: z.enum(["sales", "products", "payments", "inventory", "movements", "purchases", "refunds", "shifts", "margin"]).optional(),
  branch: optionalId,
  cashier: optionalId,
  category: optionalId,
  period: z.enum(["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"]).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  format: z.enum(["json", "csv"]).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
});

/* --------------------------------- Settings --------------------------------- */

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: optionalText(30),
  address: optionalText(1000),
  timezone: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().length(3, "Kode mata uang harus 3 huruf.").toUpperCase().optional(),
  receiptPrefix: z.string().trim().min(1).max(20).optional(),
  taxRate: basisPoints.optional(),
  allowNegativeStock: z.boolean().optional(),
});

export const branchInputSchema = z.object({
  name,
  code: z.string().trim().min(1, "Kode cabang wajib diisi.").max(30).toUpperCase(),
  phone: optionalText(30),
  address: optionalText(1000),
  isActive: z.boolean().optional(),
});

export const paymentMethodInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi.")
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Kode hanya boleh huruf kecil, angka, - dan _."),
  name,
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const auditListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  action: z.string().trim().max(120).optional(),
  actor: optionalId,
  branch: optionalId,
  from: dateString.optional(),
  to: dateString.optional(),
});

/* -------------------------------- Registration ------------------------------- */

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2, "Nama bisnis wajib diisi.").max(160),
  name: z.string().trim().min(1, "Nama Anda wajib diisi.").max(120),
  email: z.string().trim().email("Format email tidak valid.").max(254),
  password: z.string().min(12, "Password minimal 12 karakter.").max(128),
  timezone: z.string().trim().max(80).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Format email tidak valid.").max(254),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
