import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { unitInputSchema } from "@/lib/validation/pos-schemas";
import { deleteUnit, updateUnit } from "@/lib/catalog/service";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(unitInputSchema.partial(), await parseJsonBody(request));
  const data = await updateUnit(session, id, body);
  return jsonOk(data, requestId);
});

export const DELETE = withMutation<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  const data = await deleteUnit(session, id);
  return jsonOk(data, requestId);
});
