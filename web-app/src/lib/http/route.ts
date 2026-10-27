import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { ERRORS } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/request";
import { getRequestId, jsonError } from "@/lib/http/response";
import type { SessionContext } from "@/lib/auth/session";

type Handler<C> = (
  session: SessionContext,
  request: Request,
  requestId: string,
  context: C,
) => Promise<Response>;

/**
 * Wraps an authenticated API handler. Use for GET requests.
 * The session is always resolved server-side; the client never supplies
 * organization, branch, role, or permissions.
 */
export function withSession<C = unknown>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const requestId = getRequestId(request);
    try {
      const session = await getApiSession(request);
      if (!session) throw ERRORS.sessionExpired();
      return await handler(session, request, requestId, context);
    } catch (error) {
      return jsonError(error, requestId) as NextResponse;
    }
  };
}

/**
 * Wraps a mutating API handler and enforces a same-origin check first.
 * Use for POST, PATCH, PUT, DELETE.
 */
export function withMutation<C = unknown>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const requestId = getRequestId(request);
    try {
      assertSameOrigin(request);
      const session = await getApiSession(request);
      if (!session) throw ERRORS.sessionExpired();
      return await handler(session, request, requestId, context);
    } catch (error) {
      return jsonError(error, requestId) as NextResponse;
    }
  };
}
