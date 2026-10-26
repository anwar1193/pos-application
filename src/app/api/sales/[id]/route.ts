import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { getSale } from "@/lib/sales/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await getSale(session, id), requestId);
});
