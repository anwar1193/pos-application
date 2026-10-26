import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { customerInputSchema } from "@/lib/validation/pos-schemas";
import { getCustomer, updateCustomer } from "@/lib/customers/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await getCustomer(session, id), requestId);
});

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(customerInputSchema.partial(), await parseJsonBody(request));
  return jsonOk(await updateCustomer(session, id, body), requestId);
});
