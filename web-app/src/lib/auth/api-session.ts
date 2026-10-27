import { SESSION_COOKIE, validateSessionToken, type SessionContext } from "@/lib/auth/session";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function getApiSession(request: Request): Promise<SessionContext | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return validateSessionToken(token);
}
