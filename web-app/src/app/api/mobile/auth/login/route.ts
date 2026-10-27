import { NextResponse } from "next/server";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { mobileLogin } from "@/lib/mobile/auth";
import { parseInput } from "@/lib/validation/parse";
import { mobileLoginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = parseInput(mobileLoginSchema, await parseJsonBody(request));
    const result = await mobileLogin({
      email: body.email,
      password: body.password,
      deviceName: body.deviceName,
      ipHash: getIpHash(request),
      userAgent: getUserAgent(request),
      requestId,
    });

    return jsonOk(
      {
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
        user: result.session.user,
        organization: result.session.organization,
        membership: result.session.membership,
        permissions: result.session.permissions,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
