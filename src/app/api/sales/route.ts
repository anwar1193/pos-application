import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { saleCreateSchema, saleListQuerySchema } from "@/lib/validation/pos-schemas";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { createSale, listSales } from "@/lib/sales/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(saleListQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const result = await listSales(session, query);
  return jsonOk(
    { items: result.items, summary: result.summary },
    requestId,
    {
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      },
    },
  );
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(saleCreateSchema, await parseJsonBody(request));
  const data = await createSale(session, body, undefined, {
    ipHash: getIpHash(request),
    userAgent: getUserAgent(request),
  });
  return jsonOk(data, requestId, { status: 201 });
});
