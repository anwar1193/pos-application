CREATE TABLE `cash_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cash_movements_type_check" CHECK("cash_movements"."type" in ('in','out')),
	CONSTRAINT "cash_movements_amount_check" CHECK("cash_movements"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `cash_movements_shift_idx` ON `cash_movements` (`shift_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_status_check" CHECK("categories"."status" in ('active','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_org_name_unique` ON `categories` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `categories_org_status_idx` ON `categories` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `counters` (
	`organization_id` text NOT NULL,
	`key` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`organization_id`, `key`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customers_status_check" CHECK("customers"."status" in ('active','archived'))
);
--> statement-breakpoint
CREATE INDEX `customers_org_name_idx` ON `customers` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `customers_org_phone_idx` ON `customers` (`organization_id`,`phone`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_payload` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_keys_org_key_unique` ON `idempotency_keys` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_expires_idx` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `inventory_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`reserved_quantity` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_balances_branch_product_unique` ON `inventory_balances` (`branch_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_org_product_idx` ON `inventory_balances` (`organization_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_branch_idx` ON `inventory_balances` (`branch_id`);--> statement-breakpoint
CREATE TABLE `parked_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`cashier_id` text NOT NULL,
	`label` text NOT NULL,
	`cart_payload` text NOT NULL,
	`status` text DEFAULT 'parked' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "parked_sales_status_check" CHECK("parked_sales"."status" in ('parked','resumed','deleted'))
);
--> statement-breakpoint
CREATE INDEX `parked_sales_branch_status_idx` ON `parked_sales` (`branch_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_org_code_unique` ON `payment_methods` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `payment_methods_org_idx` ON `payment_methods` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`amount` integer NOT NULL,
	`reference_number` text,
	`paid_at` integer NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_status_check" CHECK("payments"."status" in ('pending','paid','failed','refunded','partially_refunded'))
);
--> statement-breakpoint
CREATE INDEX `payments_sale_idx` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `payments_org_paid_idx` ON `payments` (`organization_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`description` text,
	`category_id` text,
	`unit_id` text,
	`image_url` text,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`selling_price` integer DEFAULT 0 NOT NULL,
	`promo_price` integer,
	`tax_rate` integer,
	`track_stock` integer DEFAULT true NOT NULL,
	`minimum_stock` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_status_check" CHECK("products"."status" in ('active','archived')),
	CONSTRAINT "products_prices_check" CHECK("products"."cost_price" >= 0 and "products"."selling_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_org_sku_unique` ON `products` (`organization_id`,`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_org_barcode_unique` ON `products` (`organization_id`,`barcode`);--> statement-breakpoint
CREATE INDEX `products_org_status_idx` ON `products` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `products_org_category_idx` ON `products` (`organization_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `products_org_name_idx` ON `products` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` integer NOT NULL,
	`received_quantity` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_order_items_unique` ON `purchase_order_items` (`purchase_order_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_items_po_idx` ON `purchase_order_items` (`purchase_order_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`ordered_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_orders_status_check" CHECK("purchase_orders"."status" in ('draft','ordered','partially_received','received','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_org_number_unique` ON `purchase_orders` (`organization_id`,`number`);--> statement-breakpoint
CREATE INDEX `purchase_orders_org_status_idx` ON `purchase_orders` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `refund_items` (
	`id` text PRIMARY KEY NOT NULL,
	`refund_id` text NOT NULL,
	`sale_item_id` text NOT NULL,
	`quantity` real NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `refund_items_refund_idx` ON `refund_items` (`refund_id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`approved_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "refunds_status_check" CHECK("refunds"."status" in ('pending','approved','rejected'))
);
--> statement-breakpoint
CREATE INDEX `refunds_sale_idx` ON `refunds` (`sale_id`);--> statement-breakpoint
CREATE INDEX `refunds_org_created_idx` ON `refunds` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sale_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`approved_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_adjustments_type_check" CHECK("sale_adjustments"."type" in ('void','refund'))
);
--> statement-breakpoint
CREATE INDEX `sale_adjustments_sale_idx` ON `sale_adjustments` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`sku` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` integer NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`line_total` integer NOT NULL,
	`track_stock` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`receipt_number` text NOT NULL,
	`customer_id` text,
	`cashier_id` text NOT NULL,
	`shift_id` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`grand_total` integer DEFAULT 0 NOT NULL,
	`paid_total` integer DEFAULT 0 NOT NULL,
	`change_total` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`sold_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_status_check" CHECK("sales"."status" in ('completed','voided','partially_refunded','refunded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_org_receipt_unique` ON `sales` (`organization_id`,`receipt_number`);--> statement-breakpoint
CREATE INDEX `sales_org_branch_sold_idx` ON `sales` (`organization_id`,`branch_id`,`sold_at`);--> statement-breakpoint
CREATE INDEX `sales_org_cashier_idx` ON `sales` (`organization_id`,`cashier_id`,`sold_at`);--> statement-breakpoint
CREATE INDEX `sales_org_customer_idx` ON `sales` (`organization_id`,`customer_id`,`sold_at`);--> statement-breakpoint
CREATE INDEX `sales_shift_idx` ON `sales` (`shift_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`cashier_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opening_amount` integer DEFAULT 0 NOT NULL,
	`expected_amount` integer,
	`actual_amount` integer,
	`difference` integer,
	`notes` text,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shifts_status_check" CHECK("shifts"."status" in ('open','closed'))
);
--> statement-breakpoint
CREATE INDEX `shifts_branch_status_idx` ON `shifts` (`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `shifts_cashier_idx` ON `shifts` (`cashier_id`,`status`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`balance_after` real NOT NULL,
	`reference_type` text,
	`reference_id` text,
	`reason` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movements_type_check" CHECK("stock_movements"."type" in ('initial','purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','opname','void'))
);
--> statement-breakpoint
CREATE INDEX `stock_movements_org_created_idx` ON `stock_movements` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_branch_product_idx` ON `stock_movements` (`branch_id`,`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_reference_idx` ON `stock_movements` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE TABLE `stock_opname_items` (
	`id` text PRIMARY KEY NOT NULL,
	`opname_id` text NOT NULL,
	`product_id` text NOT NULL,
	`system_quantity` real NOT NULL,
	`counted_quantity` real NOT NULL,
	`difference` real NOT NULL,
	FOREIGN KEY (`opname_id`) REFERENCES `stock_opnames`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_opname_items_unique` ON `stock_opname_items` (`opname_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `stock_opname_items_opname_idx` ON `stock_opname_items` (`opname_id`);--> statement-breakpoint
CREATE TABLE `stock_opnames` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_opnames_status_check" CHECK("stock_opnames"."status" in ('draft','completed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX `stock_opnames_org_branch_idx` ON `stock_opnames` (`organization_id`,`branch_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `stock_transfer_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`requested_quantity` real NOT NULL,
	`sent_quantity` real DEFAULT 0 NOT NULL,
	`received_quantity` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_transfer_items_unique` ON `stock_transfer_items` (`transfer_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `stock_transfer_items_transfer_idx` ON `stock_transfer_items` (`transfer_id`);--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`from_branch_id` text NOT NULL,
	`to_branch_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`requested_by` text,
	`approved_by` text,
	`received_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_transfers_status_check" CHECK("stock_transfers"."status" in ('draft','requested','approved','in_transit','partially_received','received','cancelled'))
);
--> statement-breakpoint
CREATE INDEX `stock_transfers_org_status_idx` ON `stock_transfers` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "suppliers_status_check" CHECK("suppliers"."status" in ('active','archived'))
);
--> statement-breakpoint
CREATE INDEX `suppliers_org_name_idx` ON `suppliers` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_org_name_unique` ON `units` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `units_org_idx` ON `units` (`organization_id`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `address` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `receipt_prefix` text DEFAULT 'POS' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `tax_rate` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `allow_negative_stock` integer DEFAULT false NOT NULL;