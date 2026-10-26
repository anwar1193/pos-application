import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { purchaseActionSchema } from "@/lib/validation/pos-schemas";
import { actOnPurchaseOrder } from "@/lib/purchasing/service";

type Context = { params: Promise<{ id: string }> };

export const POST = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(purchaseActionSchema, await parseJsonBody(request));
  return jsonOk(await actOnPurchaseOrder(session, id, body.action), requestId);
});
