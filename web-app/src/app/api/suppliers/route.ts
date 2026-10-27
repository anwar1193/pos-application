import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { contactListQuerySchema, supplierInputSchema } from "@/lib/validation/pos-schemas";
import { createSupplier, listSuppliers } from "@/lib/customers/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(contactListQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const result = await listSuppliers(session, query);
  return jsonOk(result.items, requestId, {
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
  });
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(supplierInputSchema, await parseJsonBody(request));
  return jsonOk(await createSupplier(session, body), requestId, { status: 201 });
});
