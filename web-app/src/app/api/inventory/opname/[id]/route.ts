import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { opnameCompleteSchema } from "@/lib/validation/pos-schemas";
import { completeOpname, getOpname } from "@/lib/inventory/service";

type Context = { params: Promise<{ id: string }> };

export const GET = withSession<Context>(async (session, _request, requestId, context) => {
  const { id } = await context.params;
  return jsonOk(await getOpname(session, id), requestId);
});

/** Completes the opname and applies the counted quantities to stock. */
export const POST = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(opnameCompleteSchema, await parseJsonBody(request).catch(() => ({})));
  return jsonOk(await completeOpname(session, id, body), requestId);
});
