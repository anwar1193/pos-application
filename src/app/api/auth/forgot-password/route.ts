import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { assertSameOrigin, getIpHash } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { forgotPasswordSchema } from "@/lib/validation/pos-schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const body = parseInput(forgotPasswordSchema, await parseJsonBody(request));
    const result = await requestPasswordReset({ email: body.email, ipHash: getIpHash(request) });
    return jsonOk(
      {
        message:
          "Jika email tersebut terdaftar, tautan pengaturan ulang password telah dikirim.",
        ...(result.resetUrl ? { resetUrl: result.resetUrl } : {}),
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
