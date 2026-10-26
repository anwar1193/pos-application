import { cookies } from "next/headers";
import { SESSION_COOKIE, validateSessionToken, type SessionContext } from "@/lib/auth/session";

export async function getCurrentSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await validateSessionToken(token);
  } catch (error) {
    console.error("Session validation failed", error);
    return null;
  }
}
