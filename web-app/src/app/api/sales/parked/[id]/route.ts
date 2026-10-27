import { withMutation } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { deleteParkedSale } from "@/lib/sales/service";

type Context = { params: Promise<{ id: string }> };

export const DELETE = withMutation<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await deleteParkedSale(session, id), requestId);
});
