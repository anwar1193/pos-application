import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { productBulkSchema } from "@/lib/validation/pos-schemas";
import { bulkUpdateProducts } from "@/lib/catalog/service";

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(productBulkSchema, await parseJsonBody(request));
  return jsonOk(await bulkUpdateProducts(session, body), requestId);
});
