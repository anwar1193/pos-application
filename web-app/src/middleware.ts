import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pos_session";
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/users",
  "/account",
  "/pos",
  "/sales",
  "/shifts",
  "/catalog",
  "/inventory",
  "/customers",
  "/suppliers",
  "/purchases",
  "/reports",
  "/settings",
  "/audit",
];

/**
 * Cheap first gate: redirect visitors with no session cookie away from admin
 * pages. Real validation (token hash, expiry, RBAC) happens server-side in the
 * page guards.
 *
 * This deliberately does NOT redirect /login when a cookie exists: a cookie can
 * be stale or revoked, and bouncing /login -> /dashboard while the page guard
 * bounces /dashboard -> /login is an infinite redirect loop. The login page
 * itself redirects only after validating the session.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    const destination = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(destination)}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pos-path", `${pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/account/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/shifts/:path*",
    "/catalog/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/suppliers/:path*",
    "/purchases/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/audit/:path*",
  ],
};
