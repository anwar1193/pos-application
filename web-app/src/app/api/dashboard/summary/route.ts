import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { getDashboardSummary } from "@/lib/dashboard/service";
import { ERRORS } from "@/lib/http/errors";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const data = await getDashboardSummary(session);
    const response = jsonOk(data, requestId);
    response.headers.set("Cache-Control", "private, max-age=30");
    return response;
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
