export class ClientApiError extends Error {
  code: string | undefined;
  fields: Record<string, string>;

  constructor(message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.fields = fields ?? {};
  }
}

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ClientApiError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    throw new ClientApiError(
      body?.error?.message ?? "Terjadi kesalahan. Silakan coba lagi.",
      body?.error?.code,
      body?.error?.fields,
    );
  }
  return body?.data as T;
}
