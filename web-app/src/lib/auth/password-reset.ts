import { and, count, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { normalizeEmail, generateOpaqueToken, hashToken, hashEmail } from "@/lib/auth/tokens";
import { RATE_WINDOW_MS } from "@/lib/auth/rate-limit";
import { sendMail, appUrl } from "@/lib/email/mailer";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { createId } from "@/lib/ids";
import { ERRORS } from "@/lib/http/errors";
import { loginAttempts, memberships, passwordResetTokens, users } from "@/db/schema";

const RESET_TTL_MS = 30 * 60 * 1000;
const FORGOT_LIMIT_PER_WINDOW = 5;

/**
 * Issues a password-reset link. The response is always generic so the endpoint
 * cannot be used to discover which emails have accounts.
 */
export async function requestPasswordReset(
  input: { email: string; ipHash: string },
  db: Database = getDb(),
): Promise<{ resetUrl?: string }> {
  const email = normalizeEmail(input.email);
  const emailHash = hashEmail(email);

  const recentRows = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.success, true),
        gte(loginAttempts.createdAt, new Date(Date.now() - RATE_WINDOW_MS)),
      ),
    );
  if ((recentRows[0]?.value ?? 0) >= FORGOT_LIMIT_PER_WINDOW) throw ERRORS.rateLimited();

  // Record the request so repeated calls in the window are throttled, whether
  // or not the email exists. This does not affect login failure counters.
  await db.insert(loginAttempts).values({
    id: createId("lga"),
    emailHash,
    ipHash: input.ipHash,
    success: true,
    createdAt: new Date(),
  });

  const user = (
    await db
      .select({ id: users.id, name: users.name, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0];

  if (!user || user.status === "suspended" || user.status === "disabled") {
    return {};
  }

  // Every membership must be active for the account to be usable.
  const membership = (
    await db
      .select({ organizationId: memberships.organizationId })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active")))
      .limit(1)
  )[0];

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      id: createId("prt"),
      userId: user.id,
      tokenHash,
      createdBy: null,
      expiresAt,
      createdAt: now,
    });
    if (membership) {
      await writeAuditBestEffort(
        {
          organizationId: membership.organizationId,
          actorUserId: user.id,
          action: "user.password_reset_requested",
          entityType: "user",
          entityId: user.id,
          metadata: { via: "forgot_password" },
        },
        tx as unknown as Database,
      );
    }
  });

  const resetUrl = `${appUrl()}/reset-password/${token}`;
  const delivery = await sendMail({
    to: email,
    subject: "Atur ulang password akun POS Anda",
    text: `Halo ${user.name},\n\nGunakan tautan berikut untuk mengatur ulang password Anda. Tautan berlaku 30 menit dan hanya dapat dipakai sekali:\n\n${resetUrl}\n\nJika Anda tidak meminta ini, abaikan email ini.`,
  });

  if (!delivery.delivered && process.env.NODE_ENV !== "production" && process.env.EMAIL_DEV_MODE === "true") {
    return { resetUrl };
  }
  return {};
}
