export type ApiErrorFields = Record<string, string>;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: ApiErrorFields;

  constructor(code: string, status: number, message: string, fields?: ApiErrorFields) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export const ERRORS = {
  authRequired: () => new ApiError("AUTH_REQUIRED", 401, "Anda harus masuk terlebih dahulu."),
  invalidCredentials: () =>
    new ApiError("AUTH_INVALID_CREDENTIALS", 401, "Email atau password salah."),
  sessionExpired: () => new ApiError("AUTH_SESSION_EXPIRED", 401, "Sesi Anda telah berakhir."),
  accountLocked: () =>
    new ApiError("AUTH_ACCOUNT_LOCKED", 423, "Terlalu banyak percobaan. Coba lagi beberapa saat lagi."),
  accountInactive: () =>
    new ApiError("AUTH_ACCOUNT_INACTIVE", 403, "Akun Anda tidak aktif. Hubungi administrator."),
  forbidden: (message = "Anda tidak memiliki akses.") => new ApiError("FORBIDDEN", 403, message),
  rateLimited: () =>
    new ApiError("RATE_LIMITED", 429, "Terlalu banyak percobaan. Coba lagi nanti."),
  validation: (fields?: ApiErrorFields, message = "Input tidak valid.") =>
    new ApiError("VALIDATION_ERROR", 422, message, fields),
  userEmailExists: () =>
    new ApiError("USER_EMAIL_EXISTS", 409, "Email sudah terdaftar pada organisasi ini."),
  invitationExpired: () =>
    new ApiError("INVITATION_EXPIRED", 410, "Undangan sudah kedaluwarsa atau telah dipakai."),
  lastOwner: () =>
    new ApiError("LAST_OWNER_PROTECTED", 409, "Owner aktif terakhir tidak dapat dinonaktifkan atau diturunkan."),
  selfDeactivation: () =>
    new ApiError("SELF_DEACTIVATION_FORBIDDEN", 409, "Anda tidak dapat menonaktifkan diri sendiri."),
  notFound: (message = "Data tidak ditemukan.") => new ApiError("NOT_FOUND", 404, message),
  conflict: (message = "Terjadi konflik pada data.") => new ApiError("CONFLICT", 409, message),
  server: () => new ApiError("INTERNAL_ERROR", 500, "Terjadi kesalahan. Silakan coba lagi."),
};
