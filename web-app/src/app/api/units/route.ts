import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { unitInputSchema } from "@/lib/validation/pos-schemas";
import { createUnit, listUnits } from "@/lib/catalog/service";

export const GET = withSession(async (session, _request, requestId) => {
  return jsonOk(await listUnits(session), requestId);
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(unitInputSchema, await parseJsonBody(request));
  const data = await createUnit(session, body);
  return jsonOk(data, requestId, { status: 201 });
});
