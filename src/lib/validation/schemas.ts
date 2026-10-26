import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

const email = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .max(254, "Email terlalu panjang.")
  .email("Format email tidak valid.");

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`)
  .max(PASSWORD_MAX_LENGTH, `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password wajib diisi.").max(PASSWORD_MAX_LENGTH),
  next: z.string().max(512).optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10).max(300),
  password,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(300),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi.").max(PASSWORD_MAX_LENGTH),
  newPassword: password,
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120, "Nama terlalu panjang."),
  email,
  roleId: z.string().min(1, "Role wajib dipilih.").max(100),
  branchId: z.string().max(100).nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  roleId: z.string().min(1).max(100).optional(),
  defaultBranchId: z.string().max(100).nullable().optional(),
});

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.string().max(100).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
  branch: z.string().max(100).optional(),
  sort: z.enum(["name", "role", "status", "lastLogin"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
