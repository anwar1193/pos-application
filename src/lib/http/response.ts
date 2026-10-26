import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, ERRORS } from "@/lib/http/errors";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
}

export function jsonOk<T>(
  data: T,
  requestId: string,
  init?: { status?: number; meta?: Record<string, unknown> },
) {
  return NextResponse.json(
    { data, meta: { requestId, ...init?.meta } },
    { status: init?.status ?? 200 },
  );
}

export function jsonError(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields ?? {},
          requestId,
        },
      },
      { status: error.status },
    );
  }
  console.error("Unhandled API error", { requestId, error });
  const fallback = ERRORS.server();
  return NextResponse.json(
    {
      error: {
        code: fallback.code,
        message: fallback.message,
        fields: {},
        requestId,
      },
    },
    { status: fallback.status },
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw ERRORS.validation(undefined, "Body harus berformat JSON.");
  }
  const text = await request.text();
  if (text.length > 20_000) {
    throw ERRORS.validation(undefined, "Payload terlalu besar.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw ERRORS.validation(undefined, "Body JSON tidak valid.");
  }
}
