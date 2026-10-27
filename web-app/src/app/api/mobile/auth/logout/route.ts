import { writeAuditBestEffort } from "@/lib/audit/audit";
import { revokeSession } from "@/lib/auth/session";
import { withMobileSession } from "@/lib/http/mobile-route";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { jsonOk } from "@/lib/http/response";

export const POST = withMobileSession(async (session, request, requestId) => {
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
  return jsonOk({ ok: true }, requestId);
});
