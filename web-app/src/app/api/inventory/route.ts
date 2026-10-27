import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { inventoryQuerySchema } from "@/lib/validation/pos-schemas";
import { listInventory } from "@/lib/inventory/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(inventoryQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const result = await listInventory(session, query);
  return jsonOk(result.items, requestId, {
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
  });
});
