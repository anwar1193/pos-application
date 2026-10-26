import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { shiftCloseSchema } from "@/lib/validation/pos-schemas";
import { closeShift } from "@/lib/shifts/service";

type Context = { params: Promise<{ id: string }> };

export const POST = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(shiftCloseSchema, await parseJsonBody(request));
  return jsonOk(await closeShift(session, id, body), requestId);
});
