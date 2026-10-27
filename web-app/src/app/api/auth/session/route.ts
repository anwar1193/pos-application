import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth/api-session";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ERRORS } from "@/lib/http/errors";
import { getRequestId, jsonError, jsonOk } from "@/lib/http/response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await getApiSession(request);
    if (!session) throw ERRORS.sessionExpired();
    return jsonOk(
      {
        user: session.user,
        organization: session.organization,
        membership: session.membership,
        permissions: session.permissions,
        can: Object.fromEntries(
          Object.values(PERMISSIONS).map((permission) => [
            permission,
            hasPermission(session, permission),
          ]),
        ),
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId) as NextResponse;
  }
}
