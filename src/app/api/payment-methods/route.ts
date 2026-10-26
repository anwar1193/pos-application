import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { listPaymentMethods } from "@/lib/settings/service";

export const GET = withSession(async (session, request, requestId) => {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  return jsonOk(await listPaymentMethods(session, { includeInactive }), requestId);
});
