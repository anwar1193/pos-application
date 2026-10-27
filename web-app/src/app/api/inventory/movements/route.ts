import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { movementQuerySchema } from "@/lib/validation/pos-schemas";
import { listMovements } from "@/lib/inventory/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(movementQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const result = await listMovements(session, query);
  return jsonOk(result.items, requestId, {
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
  });
});
