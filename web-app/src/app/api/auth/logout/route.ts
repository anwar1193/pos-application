import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { writeAuditBestEffort } from "@/lib/audit/audit";
import { revokeSession } from "@/lib/auth/session";
import { assertSameOrigin, getIpHash, getUserAgent } from "@/lib/http/request";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const session = await getApiSession(request);
    if (session) {
      await revokeSession(session.sessionId, "logout");
      await writeAuditBestEffort({
        organizationId: session.organization.id,
        actorUserId: session.user.id,
        action: "auth.logout",
        entityType: "session",
        entityId: session.sessionId,
        metadata: { requestId },
        ipHash: getIpHash(request),
        userAgent: getUserAgent(request),
      });
    }
    const response = jsonOk({ redirectTo: "/login" }, requestId);
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
