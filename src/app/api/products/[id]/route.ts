import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { productInputSchema } from "@/lib/validation/pos-schemas";
import { archiveProduct, getProduct, updateProduct } from "@/lib/catalog/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const branch = new URL(request.url).searchParams.get("branch");
  return jsonOk(await getProduct(session, id, branch), requestId);
});

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(productInputSchema.partial(), await parseJsonBody(request));
  return jsonOk(await updateProduct(session, id, body), requestId);
});

export const DELETE = withMutation<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await archiveProduct(session, id), requestId);
});
