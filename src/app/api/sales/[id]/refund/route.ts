import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { saleRefundSchema } from "@/lib/validation/pos-schemas";
import { getIpHash, getUserAgent } from "@/lib/http/request";
import { refundSale } from "@/lib/sales/service";

type Context = { params: Promise<{ id: string }> };

export const POST = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(saleRefundSchema, await parseJsonBody(request));
  const data = await refundSale(session, id, body, undefined, {
    ipHash: getIpHash(request),
    userAgent: getUserAgent(request),
  });
  return jsonOk(data, requestId);
});
