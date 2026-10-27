import { NextResponse } from "next/server";
import { login } from "@/lib/auth/login";
import { setSessionCookie } from "@/lib/auth/cookie";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const body = parseInput(loginSchema, await parseJsonBody(request));
    const result = await login({
      email: body.email,
      password: body.password,
      next: body.next,
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    const response = jsonOk(
      { redirectTo: result.redirectTo, sessionId: result.sessionId },
      requestId,
    );
    setSessionCookie(response, result.token, result.absoluteExpiresAt);
    return response;
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
