import type { ZodType } from "zod";
import { ERRORS } from "@/lib/http/errors";

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    throw ERRORS.validation(fields);
  }
  return result.data;
}
