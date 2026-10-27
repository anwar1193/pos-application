import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { searchCustomers } from "@/lib/customers/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return jsonOk([], requestId);
  return jsonOk(await searchCustomers(session, q), requestId);
});
