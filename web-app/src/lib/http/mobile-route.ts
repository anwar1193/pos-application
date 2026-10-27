import { NextResponse } from "next/server";
import { validateSessionToken, type SessionContext } from "@/lib/auth/session";
import type { Database } from "@/lib/db/client";
import { ERRORS } from "@/lib/http/errors";
import { getRequestId, jsonError } from "@/lib/http/response";

const BEARER_PREFIX = "Bearer ";

/**
 * Resolves a mobile session from the Authorization header. Only explicit
 * `Bearer <token>` credentials are accepted; web cookie sessions never are.
 */
export async function getMobileSession(
  request: Request,
  db?: Database,
): Promise<SessionContext | null> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) return null;
  return validateSessionToken(token, db);
}

type Handler<C> = (
  session: SessionContext,
  request: Request,
  requestId: string,
  context: C,
) => Promise<Response>;

/**
 * Wraps an authenticated mobile API handler. Unlike the web routes it does not
 * enforce a same-origin check, because native clients send no Origin header.
 */
export function withMobileSession<C = unknown>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const requestId = getRequestId(request);
    try {
      const session = await getMobileSession(request, undefined);
      if (!session) throw ERRORS.sessionExpired();
      return await handler(session, request, requestId, context);
    } catch (error) {
      return jsonError(error, requestId) as NextResponse;
    }
  };
}
