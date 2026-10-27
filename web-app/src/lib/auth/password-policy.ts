export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyContext = {
  email?: string;
  name?: string;
};

/**
 * Pure password policy check. Kept separate from the Argon2 hashing module so
 * client components can validate against the same rules without bundling a
 * native server dependency.
 */
export function validatePasswordPolicy(
  password: string,
  context: PasswordPolicyContext = {},
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  }
  if (password.trim().length === 0) {
    return "Password tidak boleh kosong.";
  }
  const lowered = password.toLowerCase();
  if (context.email && lowered === context.email.trim().toLowerCase()) {
    return "Password tidak boleh sama dengan email.";
  }
  if (context.name && lowered === context.name.trim().toLowerCase()) {
    return "Password tidak boleh sama dengan nama.";
  }
  return null;
}
