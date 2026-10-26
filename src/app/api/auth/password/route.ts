import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { changeOwnPassword } from "@/lib/users/service";
import { setSessionCookie } from "@/lib/auth/cookie";
import { ERRORS } from "@/lib/http/errors";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { changePasswordSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const body = parseInput(changePasswordSchema, await parseJsonBody(request));
    const result = await changeOwnPassword(session, body.currentPassword, body.newPassword, {
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    const response = jsonOk({ ok: true }, requestId);
    setSessionCookie(response, result.token, result.absoluteExpiresAt);
    return response;
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
