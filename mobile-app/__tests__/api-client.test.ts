import { ApiError, apiRequest } from "@/api/client";

const originalFetch = global.fetch;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe("apiRequest", () => {
  it("calls the configured base URL and attaches the bearer token", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://api.test:4000/";
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response({ data: { ok: true }, meta: { requestId: "req-1" } }));
    global.fetch = fetchMock;

    await expect(apiRequest("/api/mobile/dashboard", { token: "secret" })).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test:4000/api/mobile/dashboard",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
  });

  it("sends a JSON body and content type for mutations", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response({ data: { token: "abc" }, meta: { requestId: "req-2" } }));
    global.fetch = fetchMock;

    await apiRequest("/api/mobile/auth/login", {
      method: "POST",
      body: { email: "rani@demostore.id", password: "demoKasir2026!" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "rani@demostore.id", password: "demoKasir2026!" }),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("throws an ApiError with the server code and status", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      response(
        {
          error: {
            code: "AUTH_SESSION_EXPIRED",
            message: "Sesi Anda berakhir.",
            requestId: "req-3",
          },
        },
        401,
      ),
    );

    await expect(apiRequest("/api/mobile/auth/session", { token: "old" })).rejects.toMatchObject({
      name: "ApiError",
      code: "AUTH_SESSION_EXPIRED",
      status: 401,
      message: "Sesi Anda berakhir.",
    });
  });

  it("exposes field errors for validation failures", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      response(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data tidak valid.",
            fields: { email: "Email tidak valid." },
            requestId: "req-4",
          },
        },
        422,
      ),
    );

    const error: unknown = await apiRequest("/api/mobile/auth/login", {
      method: "POST",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fields).toEqual({ email: "Email tidak valid." });
  });

  it("maps an aborted request to a timeout ApiError", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const abort = new Error("aborted");
            abort.name = "AbortError";
            reject(abort);
          });
        }),
    ) as unknown as typeof fetch;

    const pending = apiRequest("/api/mobile/dashboard", { timeoutMs: 1000 });
    jest.advanceTimersByTime(1000);

    await expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", status: 0 });
  });

  it("maps a network failure to a friendly ApiError", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    await expect(apiRequest("/api/mobile/dashboard")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Tidak dapat terhubung ke server.",
    });
  });
});
