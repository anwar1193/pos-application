import { withMobileSession } from "@/lib/http/mobile-route";
import { jsonOk } from "@/lib/http/response";
import { getMobileDashboard } from "@/lib/mobile/dashboard";

export const GET = withMobileSession(async (session, _request, requestId) => {
  const data = await getMobileDashboard(session);
  const response = jsonOk(data, requestId);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
