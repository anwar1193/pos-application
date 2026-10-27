import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { opnameCreateSchema } from "@/lib/validation/pos-schemas";
import { createOpname, listOpnames } from "@/lib/inventory/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const branch = url.searchParams.get("branch");
  const page = Number(url.searchParams.get("page") ?? 1) || 1;
  const pageSize = Math.min(200, Number(url.searchParams.get("pageSize") ?? 25) || 25);
  const result = await listOpnames(session, { branch, page, pageSize });
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
  const body = parseInput(opnameCreateSchema, await parseJsonBody(request));
  return jsonOk(await createOpname(session, body), requestId, { status: 201 });
});
