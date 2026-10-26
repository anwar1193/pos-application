import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { parkedSaleCreateSchema } from "@/lib/validation/pos-schemas";
import { ERRORS } from "@/lib/http/errors";
import { createParkedSale, listParkedSales } from "@/lib/sales/service";
import { resolveBranchId } from "@/lib/branches/service";

export const GET = withSession(async (session, request, requestId) => {
  const branch = await resolveBranchId(session, new URL(request.url).searchParams.get("branch"));
  if (!branch) throw ERRORS.validation({ branch: "Cabang tidak ditemukan." });
  return jsonOk(await listParkedSales(session, branch), requestId);
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(parkedSaleCreateSchema, await parseJsonBody(request));
  return jsonOk(await createParkedSale(session, body), requestId, { status: 201 });
});
