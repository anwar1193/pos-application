import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { branchInputSchema } from "@/lib/validation/pos-schemas";
import { updateBranch } from "@/lib/settings/service";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withMutation<Context>(async (session, request, requestId, context) => {
  const { id } = await context.params;
  const body = parseInput(branchInputSchema.partial(), await parseJsonBody(request));
  return jsonOk(await updateBranch(session, id, body), requestId);
});
