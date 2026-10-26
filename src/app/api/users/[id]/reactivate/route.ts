import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { reactivateUser } from "@/lib/users/service";
import { ERRORS } from "@/lib/http/errors";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const { id } = await context.params;
    const data = await reactivateUser(session, id, {
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    return jsonOk(data, requestId);
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
