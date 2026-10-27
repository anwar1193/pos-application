import { withSession } from "@/lib/http/route";
import { jsonOk } from "@/lib/http/response";
import { csvResponse, toCsv } from "@/lib/csv";
import { parseInput } from "@/lib/validation/parse";
import { reportQuerySchema } from "@/lib/validation/pos-schemas";
import { getReport } from "@/lib/reports/service";

export const GET = withSession(async (session, request, requestId) => {
  const url = new URL(request.url);
  const query = parseInput(reportQuerySchema, Object.fromEntries(url.searchParams.entries()));
  const report = await getReport(session, query);

  if (query.format === "csv") {
    const csv = toCsv(
      report.rows.map((row) =>
        Object.fromEntries(
          report.columns.map((column) => [column.key, String(row[column.key] ?? "")]),
        ),
      ),
      report.columns.map((column) => ({ key: column.key, header: column.header })),
    );
    return csvResponse(`${report.type}-${report.range.fromDate}.csv`, csv);
  }

  return jsonOk(report, requestId);
});
