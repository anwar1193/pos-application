import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { getPurchaseOrder } from "@/lib/purchasing/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await getPurchaseOrder(session, id), requestId);
});
