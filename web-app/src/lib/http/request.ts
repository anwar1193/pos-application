import { createHash } from "node:crypto";
import { ApiError } from "@/lib/http/errors";

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

export function getIpHash(request: Request): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? "local-rate-limit-secret";
  return createHash("sha256").update(`${secret}:${getClientIp(request)}`).digest("hex");
}

export function getUserAgent(request: Request): string {
  return (request.headers.get("user-agent") ?? "unknown").slice(0, 300);
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestOrigin = new URL(request.url).origin;
  const appUrl = process.env.APP_URL ?? requestOrigin;
  const allowedHosts = new Set<string>();
  try {
    allowedHosts.add(new URL(appUrl).host);
  } catch {
    // ignore malformed APP_URL
  }
  allowedHosts.add(new URL(requestOrigin).host);

  const source = origin ?? referer;
  if (!source) {
    throw new ApiError("FORBIDDEN", 403, "Permintaan ditolak karena origin tidak valid.");
  }
  try {
    if (!allowedHosts.has(new URL(source).host)) {
      throw new ApiError("FORBIDDEN", 403, "Permintaan ditolak karena origin tidak valid.");
    }
  } catch {
    throw new ApiError("FORBIDDEN", 403, "Permintaan ditolak karena origin tidak valid.");
  }
}
