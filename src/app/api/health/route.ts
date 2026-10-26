import { checkDatabase } from "@/lib/db/client";
import { getRequestId, jsonOk } from "@/lib/http/response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const database = await checkDatabase();
  return jsonOk({ status: database ? "ok" : "degraded", database }, requestId);
}
