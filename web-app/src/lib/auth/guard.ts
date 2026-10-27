import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { hasPermission, type SessionContext } from "@/lib/auth/session";
import { ERRORS } from "@/lib/http/errors";

export async function requirePageSession(nextPath = "/dashboard"): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requirePagePermission(
  permission: string,
  nextPath: string,
): Promise<SessionContext> {
  const session = await requirePageSession(nextPath);
  if (!hasPermission(session, permission)) {
    redirect("/403");
  }
  return session;
}

export function requireApiPermission(session: SessionContext, permission: string): void {
  if (!hasPermission(session, permission)) {
    throw ERRORS.forbidden();
  }
}
