import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { categoryInputSchema } from "@/lib/validation/pos-schemas";
import { archiveCategory, updateCategory } from "@/lib/catalog/service";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(categoryInputSchema.partial(), await parseJsonBody(request));
  const data = await updateCategory(session, id, body);
  return jsonOk(data, requestId);
});

export const DELETE = withMutation<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  const data = await archiveCategory(session, id);
  return jsonOk(data, requestId);
});
