import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { organizationUpdateSchema } from "@/lib/validation/pos-schemas";
import { updateOrganizationSettings } from "@/lib/settings/service";

export const PATCH = withMutation(async (session, request, requestId) => {
  const body = parseInput(organizationUpdateSchema, await parseJsonBody(request));
  return jsonOk(await updateOrganizationSettings(session, body), requestId);
});
