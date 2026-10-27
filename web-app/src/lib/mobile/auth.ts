import { login } from "@/lib/auth/login";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateSessionToken, type SessionContext } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { ERRORS } from "@/lib/http/errors";

// Roles that cannot see a shift or a sale have no screen to land on in the
// cashier app; rejecting them at login beats a permanent 403 on the dashboard.
const MOBILE_PERMISSIONS = [PERMISSIONS.shiftView, PERMISSIONS.saleView];

export type MobileLoginInput = {
  email: string;
  password: string;
  deviceName?: string;
  ipHash: string;
  userAgent: string;
  requestId: string;
};

export type MobileLoginResult = {
  token: string;
  expiresAt: Date;
  session: SessionContext;
};

/**
 * Authenticates a mobile client and validates the freshly created session,
 * so the caller receives the same session shape the bearer endpoints use.
 */
export async function mobileLogin(
  input: MobileLoginInput,
  db: Database = getDb(),
): Promise<MobileLoginResult> {
  const deviceName = input.deviceName?.trim();
  const userAgent = deviceName
    ? `${input.userAgent} (${deviceName})`.slice(0, 300)
    : input.userAgent;

  const result = await login(
    {
      email: input.email,
      password: input.password,
      ipHash: input.ipHash,
      userAgent,
      requestId: input.requestId,
    },
    db,
  );

  const session = await validateSessionToken(result.token, db);
  if (!session) throw ERRORS.server();

  if (!MOBILE_PERMISSIONS.every((permission) => session.permissions.includes(permission))) {
    throw ERRORS.forbidden("Akun ini tidak memiliki akses aplikasi kasir mobile.");
  }

  return {
    token: result.token,
    expiresAt: result.absoluteExpiresAt,
    session,
  };
}
