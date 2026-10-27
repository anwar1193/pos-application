import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { supplierInputSchema } from "@/lib/validation/pos-schemas";
import { updateSupplier } from "@/lib/customers/service";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(supplierInputSchema.partial(), await parseJsonBody(request));
  return jsonOk(await updateSupplier(session, id, body), requestId);
});
