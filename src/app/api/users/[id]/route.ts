import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { getUserDetail, updateUser } from "@/lib/users/service";
import { ERRORS } from "@/lib/http/errors";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { updateUserSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const { id } = await context.params;
    const data = await getUserDetail(session, id);
    return jsonOk(data, requestId);
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const { id } = await context.params;
    const body = parseInput(updateUserSchema, await parseJsonBody(request));
    const data = await updateUser(session, id, body, {
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    return jsonOk(data, requestId);
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
