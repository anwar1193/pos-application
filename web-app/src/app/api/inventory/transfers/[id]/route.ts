import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { transferActionSchema } from "@/lib/validation/pos-schemas";
import { actOnTransfer, getTransfer } from "@/lib/inventory/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await getTransfer(session, id), requestId);
});

export const POST = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(transferActionSchema, await parseJsonBody(request));
  return jsonOk(await actOnTransfer(session, id, body), requestId);
});
