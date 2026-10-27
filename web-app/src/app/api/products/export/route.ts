import { withSession } from "@/lib/http/route";
import { csvResponse } from "@/lib/csv";
import { exportProductsCsv } from "@/lib/catalog/service";

export const GET = withSession(async (session, request) => {
  const branch = new URL(request.url).searchParams.get("branch");
  const csv = await exportProductsCsv(session, branch);
  return csvResponse(`produk-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
