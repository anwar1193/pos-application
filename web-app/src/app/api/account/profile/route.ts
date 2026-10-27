import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { parseInput } from "@/lib/validation/parse";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { updateOwnProfile } from "@/lib/users/service";

export const PATCH = withMutation(async (session, request, requestId) => {
  const body = parseInput(profileUpdateSchema, await parseJsonBody(request));
  const data = await updateOwnProfile(session, body, {
    ipHash: getIpHash(request),
    userAgent: getUserAgent(request),
    requestId,
  });
  return jsonOk(data, requestId);
});
