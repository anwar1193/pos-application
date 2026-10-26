import { withMutation } from "@/lib/http/route";
import { jsonOk, parseJsonBody } from "@/lib/http/response";
import { parseInput } from "@/lib/validation/parse";
import { branchInputSchema } from "@/lib/validation/pos-schemas";
import { createBranch } from "@/lib/settings/service";

export const POST = withMutation(async (session, request, requestId) => {
  const body = parseInput(branchInputSchema, await parseJsonBody(request));
  return jsonOk(await createBranch(session, body), requestId, { status: 201 });
});
