export const PERMISSIONS = {
  dashboardView: "dashboard.view",
  userView: "user.view",
  userInvite: "user.invite",
  userUpdate: "user.update",
  userDeactivate: "user.deactivate",
  userResetPassword: "user.reset_password",
  roleAssign: "role.assign",
  sessionRevoke: "session.revoke",
  auditView: "audit.view",
  catalogView: "catalog.view",
  catalogManage: "catalog.manage",
  inventoryView: "inventory.view",
  inventoryAdjust: "inventory.adjust",
  inventoryOpname: "inventory.opname",
  inventoryTransfer: "inventory.transfer",
  saleCreate: "sale.create",
  saleView: "sale.view",
  saleVoid: "sale.void",
  saleRefund: "sale.refund",
  shiftView: "shift.view",
  shiftManage: "shift.manage",
  shiftApprove: "shift.approve",
  customerView: "customer.view",
  customerManage: "customer.manage",
  supplierView: "supplier.view",
  supplierManage: "supplier.manage",
  purchaseView: "purchase.view",
  purchaseManage: "purchase.manage",
  purchaseReceive: "purchase.receive",
  reportView: "report.view",
  settingsManage: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "dashboard.view": "Melihat dashboard",
  "user.view": "Melihat daftar dan detail user",
  "user.invite": "Mengundang user baru",
  "user.update": "Mengubah data, role, dan cabang user",
  "user.deactivate": "Menonaktifkan atau mengaktifkan user",
  "user.reset_password": "Membuat link reset password",
  "role.assign": "Memberikan role kepada user",
  "session.revoke": "Mencabut session user lain",
  "audit.view": "Melihat audit log",
  "catalog.view": "Melihat produk, kategori, dan satuan",
  "catalog.manage": "Mengelola produk, kategori, dan satuan",
  "inventory.view": "Melihat stok dan pergerakan stok",
  "inventory.adjust": "Membuat penyesuaian stok manual",
  "inventory.opname": "Membuat dan menyelesaikan stock opname",
  "inventory.transfer": "Membuat dan memproses transfer stok",
  "sale.create": "Membuat transaksi penjualan",
  "sale.view": "Melihat transaksi penjualan",
  "sale.void": "Membatalkan transaksi (void)",
  "sale.refund": "Memproses refund transaksi",
  "shift.view": "Melihat shift dan rekonsiliasi kas",
  "shift.manage": "Membuka dan menutup shift",
  "shift.approve": "Menyetujui selisih kas shift",
  "customer.view": "Melihat pelanggan",
  "customer.manage": "Mengelola pelanggan",
  "supplier.view": "Melihat supplier",
  "supplier.manage": "Mengelola supplier",
  "purchase.view": "Melihat purchase order",
  "purchase.manage": "Membuat dan mengubah purchase order",
  "purchase.receive": "Menerima barang dari purchase order",
  "report.view": "Melihat dan mengekspor laporan",
  "settings.manage": "Mengelola pengaturan bisnis",
};

export const ROLE_CODES = {
  owner: "owner",
  admin: "admin",
  manager: "manager",
  cashier: "cashier",
  warehouse: "warehouse",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ROLE_NAMES: Record<RoleCode, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manajer",
  cashier: "Kasir",
  warehouse: "Staf Gudang",
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.userView,
    PERMISSIONS.auditView,
    PERMISSIONS.catalogView,
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryOpname,
    PERMISSIONS.inventoryTransfer,
    PERMISSIONS.saleView,
    PERMISSIONS.saleVoid,
    PERMISSIONS.saleRefund,
    PERMISSIONS.shiftView,
    PERMISSIONS.shiftApprove,
    PERMISSIONS.customerView,
    PERMISSIONS.customerManage,
    PERMISSIONS.supplierView,
    PERMISSIONS.purchaseView,
    PERMISSIONS.purchaseReceive,
    PERMISSIONS.reportView,
  ],
  cashier: [
    PERMISSIONS.catalogView,
    PERMISSIONS.saleCreate,
    PERMISSIONS.saleView,
    PERMISSIONS.shiftView,
    PERMISSIONS.shiftManage,
    PERMISSIONS.customerView,
    PERMISSIONS.customerManage,
  ],
  warehouse: [
    PERMISSIONS.catalogView,
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryOpname,
    PERMISSIONS.inventoryTransfer,
    PERMISSIONS.supplierView,
    PERMISSIONS.purchaseView,
    PERMISSIONS.purchaseReceive,
    PERMISSIONS.reportView,
  ],
};

export const WEB_ADMIN_ROLES: RoleCode[] = [
  ROLE_CODES.owner,
  ROLE_CODES.admin,
  ROLE_CODES.manager,
  ROLE_CODES.cashier,
  ROLE_CODES.warehouse,
];

export function canUseWebAdmin(role: string): role is RoleCode {
  return WEB_ADMIN_ROLES.includes(role as RoleCode);
}

/** Landing page after login, chosen from what the role can actually open. */
export function homePathFor(role: string): string {
  if (role === ROLE_CODES.cashier) return "/pos";
  if (role === ROLE_CODES.warehouse) return "/inventory";
  return "/dashboard";
}
