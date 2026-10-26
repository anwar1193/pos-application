import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { paymentMethodInputSchema } from "@/lib/validation/pos-schemas";
import { updatePaymentMethod } from "@/lib/settings/service";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(paymentMethodInputSchema.partial(), await parseJsonBody(request));
  return jsonOk(await updatePaymentMethod(session, id, body), requestId);
});
