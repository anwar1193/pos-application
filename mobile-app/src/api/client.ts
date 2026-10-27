const DEFAULT_BASE_URL = "http://localhost:3000";

export type ApiEnvelope<T> = {
  data: T;
  meta?: { requestId?: string };
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    requestId?: string;
  };
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    message: string,
    options: { code: string; status: number; fields?: Record<string, string> },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.fields = options.fields;
  }
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL;
  return configured.replace(/\/+$/, "");
}

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = `Bearer ${options.token}`;

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<T>
      | ApiErrorPayload
      | null;

    if (!response.ok || !payload || "error" in payload) {
      const error = payload && "error" in payload ? payload.error : null;
      throw new ApiError(error?.message ?? "Terjadi kesalahan. Coba lagi.", {
        code: error?.code ?? "UNKNOWN_ERROR",
        status: response.status,
        fields: error?.fields,
      });
    }

    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Waktu koneksi habis. Coba lagi.", {
        code: "REQUEST_TIMEOUT",
        status: 0,
      });
    }
    throw new ApiError("Tidak dapat terhubung ke server.", {
      code: "NETWORK_ERROR",
      status: 0,
    });
  } finally {
    clearTimeout(timeout);
  }
}
