import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { shiftOpenSchema } from "@/lib/validation/pos-schemas";
import { listShifts, openShift } from "@/lib/shifts/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const result = await listShifts(session, {
    branch: url.searchParams.get("branch"),
    cashier: url.searchParams.get("cashier"),
    status: url.searchParams.get("status") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1) || 1,
    pageSize: Math.min(200, Number(url.searchParams.get("pageSize") ?? 25) || 25),
  });
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
  const body = parseInput(shiftOpenSchema, await parseJsonBody(request));
  return jsonOk(await openShift(session, body), requestId, { status: 201 });
});
