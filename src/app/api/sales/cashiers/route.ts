import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { listCashiers } from "@/lib/sales/service";

export const GET = withSession(async (session, _request, requestId) => {
  return jsonOk(await listCashiers(session), requestId);
});
