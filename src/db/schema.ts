import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
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
