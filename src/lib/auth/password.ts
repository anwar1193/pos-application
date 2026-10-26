import { hash, verify } from "@node-rs/argon2";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
  type PasswordPolicyContext,
} from "@/lib/auth/password-policy";

export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordPolicy };
export type { PasswordPolicyContext };

// @node-rs/argon2 defaults to Argon2id with these parameters.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | undefined;

/** Used when an email does not exist so login timing stays comparable. */
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash("dummy-password-for-timing-only", ARGON2_OPTIONS);
  return dummyHashPromise;
}
