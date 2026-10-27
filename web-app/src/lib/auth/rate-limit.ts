import { and, count, eq, gte } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { loginAttempts } from "@/db/schema";

export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL_IP = 5;
export const MAX_FAILURES_PER_IP = 20;
export const ACCOUNT_LOCK_THRESHOLD = 10;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

export async function recordLoginAttempt(
  input: { emailHash: string; ipHash: string; success: boolean },
  db: Database = getDb(),
): Promise<void> {
  await db.insert(loginAttempts).values({
    id: createId("lga"),
    emailHash: input.emailHash,
    ipHash: input.ipHash,
    success: input.success,
    createdAt: new Date(),
  });
}

export async function countRecentFailures(
  filter: { emailHash?: string; ipHash?: string },
  db: Database = getDb(),
): Promise<number> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const conditions = [eq(loginAttempts.success, false), gte(loginAttempts.createdAt, since)];
  if (filter.emailHash) conditions.push(eq(loginAttempts.emailHash, filter.emailHash));
  if (filter.ipHash) conditions.push(eq(loginAttempts.ipHash, filter.ipHash));
  const rows = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(and(...conditions));
  return rows[0]?.value ?? 0;
}

export async function isRateLimited(
  input: { emailHash: string; ipHash: string },
  db: Database = getDb(),
): Promise<boolean> {
  const [emailIpFailures, ipFailures] = await Promise.all([
    countRecentFailures({ emailHash: input.emailHash, ipHash: input.ipHash }, db),
    countRecentFailures({ ipHash: input.ipHash }, db),
  ]);
  return (
    emailIpFailures >= MAX_FAILURES_PER_EMAIL_IP || ipFailures >= MAX_FAILURES_PER_IP
  );
}

export function nextLockout(failedAttempts: number, now = new Date()): Date | null {
  if (failedAttempts >= ACCOUNT_LOCK_THRESHOLD) {
    return new Date(now.getTime() + ACCOUNT_LOCK_MS);
  }
  return null;
}

export function isLockActive(lockedUntil: Date | null, now = new Date()): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}
