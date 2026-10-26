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
  "audit.view": "Melihat aktivitas audit di dashboard",
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

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.userView,
    PERMISSIONS.userInvite,
    PERMISSIONS.userUpdate,
    PERMISSIONS.userDeactivate,
    PERMISSIONS.userResetPassword,
    PERMISSIONS.roleAssign,
    PERMISSIONS.sessionRevoke,
    PERMISSIONS.auditView,
  ],
  manager: [PERMISSIONS.dashboardView, PERMISSIONS.userView],
  cashier: [],
  warehouse: [],
};

export const WEB_ADMIN_ROLES: RoleCode[] = [
  ROLE_CODES.owner,
  ROLE_CODES.admin,
  ROLE_CODES.manager,
];

export function canUseWebAdmin(role: string): role is RoleCode {
  return WEB_ADMIN_ROLES.includes(role as RoleCode);
}
