import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { stockAdjustSchema } from "@/lib/validation/pos-schemas";
import { adjustStock } from "@/lib/inventory/service";

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(stockAdjustSchema, await parseJsonBody(request));
  return jsonOk(await adjustStock(session, body), requestId);
});
