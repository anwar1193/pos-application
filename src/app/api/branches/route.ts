import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { listBranches } from "@/lib/users/service";
import { ERRORS } from "@/lib/http/errors";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    return jsonOk(await listBranches(session), requestId);
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
