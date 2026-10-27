import { withMobileSession } from "@/lib/http/mobile-route";
import { jsonOk } from "@/lib/http/response";

export const GET = withMobileSession(async (session, _request, requestId) =>
  jsonOk(
    {
      user: session.user,
      organization: session.organization,
      membership: session.membership,
      permissions: session.permissions,
    },
    requestId,
  ),
);
