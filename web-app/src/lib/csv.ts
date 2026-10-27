export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  const header = columns.map((column) => escape(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escape(row[column.key])).join(","));
  return [header, ...body].join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Parse a CSV file into rows keyed by the header names. Handles quoted commas. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^﻿/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(current);
      current = "";
    } else if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else if (char === "\r") {
      // skip
    } else {
      current += char;
    }
  }
  row.push(current);
  rows.push(row);

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0]!.map((cell) => cell.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}
