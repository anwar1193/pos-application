import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { productInputSchema, productListQuerySchema } from "@/lib/validation/pos-schemas";
import { createProduct, listProducts } from "@/lib/catalog/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(productListQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const result = await listProducts(session, query);
  return jsonOk(result.items, requestId, {
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      branchId: result.branchId,
    },
  });
});

export const POST = withMutation(async (session, request, requestId) => {
  const branch = new URL(request.url).searchParams.get("branch");
  const body = parseInput(productInputSchema, await parseJsonBody(request));
  const data = await createProduct(session, body, branch);
  return jsonOk(data, requestId, { status: 201 });
});
