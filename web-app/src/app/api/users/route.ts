import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { listUsers } from "@/lib/users/service";
import { ERRORS } from "@/lib/http/errors";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { userListQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    const url = new URL(request.url);
    const query = parseInput(userListQuerySchema, Object.fromEntries(url.searchParams.entries()));
    const result = await listUsers(session, query);
    return jsonOk(result.items, requestId, {
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      },
    });
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
