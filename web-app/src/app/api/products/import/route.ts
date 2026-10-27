import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { productImportSchema } from "@/lib/validation/pos-schemas";
import { importProductsCsv } from "@/lib/catalog/service";

export const POST = withMutation(async (session, request, requestId) => {
  const branch = new URL(request.url).searchParams.get("branch");
  const body = parseInput(productImportSchema, await parseJsonBody(request));
  const data = await importProductsCsv(session, body.csv, branch);
  return jsonOk(data, requestId);
});
