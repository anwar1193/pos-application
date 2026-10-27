import { z } from "zod";
import { switchOrganization } from "@/lib/auth/organizations";
import { setSessionCookie } from "@/lib/auth/cookie";
import { withMutation } from "@/lib/http/route";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";

const switchSchema = z.object({
  organizationId: z.string().min(1).max(100),
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(switchSchema, await parseJsonBody(request));
  const result = await switchOrganization(session, body.organizationId, {
    ipHash: getIpHash(request),
    userAgent: getUserAgent(request),
    requestId,
  });

  const response = jsonOk({ redirectTo: result.redirectTo }, requestId);
  if (result.token && result.absoluteExpiresAt) {
    setSessionCookie(response, result.token, result.absoluteExpiresAt);
  }
  return response;
});
