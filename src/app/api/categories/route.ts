import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { categoryInputSchema } from "@/lib/validation/pos-schemas";
import { createCategory, listCategories } from "@/lib/catalog/service";

export const GET = withSession(async (session, request, requestId) => {
  const status = new URL(request.url).searchParams.get("status");
  const data = await listCategories(session, { status });
  return jsonOk(data, requestId);
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(categoryInputSchema, await parseJsonBody(request));
  const data = await createCategory(session, body);
  return jsonOk(data, requestId, { status: 201 });
});
