import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { getCurrentShift } from "@/lib/shifts/service";

export const GET = withSession(async (session, request, requestId) => {
  const branch = new URL(request.url).searchParams.get("branch");
  return jsonOk(await getCurrentShift(session, branch), requestId);
});
