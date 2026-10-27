import { NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/users/service";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { acceptInvitationSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const body = parseInput(acceptInvitationSchema, await parseJsonBody(request));
    const result = await acceptInvitation(body.token, body.password, {
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });
    return jsonOk(result, requestId);
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
