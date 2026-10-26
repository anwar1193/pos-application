export async function send(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<void> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string; fields?: Record<string, string> } }
    | null;
  const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
  throw new Error(field ?? payload?.error?.message ?? "Permintaan gagal.");
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
