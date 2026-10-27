import { createHash, randomBytes } from "node:crypto";

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? "local-rate-limit-secret";
  return createHash("sha256").update(`${secret}:${normalizeEmail(email)}`).digest("hex");
}
