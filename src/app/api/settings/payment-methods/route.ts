import { withMutation, withSession } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { paymentMethodInputSchema } from "@/lib/validation/pos-schemas";
import { createPaymentMethod, listPaymentMethods } from "@/lib/settings/service";

export const GET = withSession(async (session, request, requestId) => {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  return jsonOk(await listPaymentMethods(session, { includeInactive }), requestId);
});

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(paymentMethodInputSchema, await parseJsonBody(request));
  return jsonOk(await createPaymentMethod(session, body), requestId, { status: 201 });
});
