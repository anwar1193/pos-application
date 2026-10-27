import { NextResponse } from "next/server";
import { registerBusiness } from "@/lib/auth/register";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { registerSchema } from "@/lib/validation/pos-schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const body = parseInput(registerSchema, await parseJsonBody(request));
    const registered = await registerBusiness(body);
    const session = await createSession({
      userId: registered.userId,
      organizationId: registered.organizationId,
      userAgent: getUserAgent(request),
      ipHash: getIpHash(request),
    });
    const response = jsonOk(
      { redirectTo: "/dashboard", organizationId: registered.organizationId },
      requestId,
      { status: 201 },
    );
    setSessionCookie(response, session.token, session.absoluteExpiresAt);
    return response;
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
