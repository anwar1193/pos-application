import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { ERRORS } from "@/lib/http/errors";
import { resolveBranchId } from "@/lib/branches/service";
import { searchProductsForSale } from "@/lib/catalog/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const branch = await resolveBranchId(session, url.searchParams.get("branch"));
  if (!branch) throw ERRORS.validation({ branch: "Cabang tidak ditemukan." });
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 24) || 24));
  const data = await searchProductsForSale(session, { branchId: branch, q, limit });
  return jsonOk(data, requestId);
});
