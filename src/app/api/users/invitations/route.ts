import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { inviteUser } from "@/lib/users/service";
import { ERRORS } from "@/lib/http/errors";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { inviteUserSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const body = parseInput(inviteUserSchema, await parseJsonBody(request));
    const result = await inviteUser(session, body, {
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    return jsonOk(result, requestId, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
