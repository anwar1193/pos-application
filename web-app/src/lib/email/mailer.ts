type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Minimal mail abstraction. Uses Resend when RESEND_API_KEY is configured;
 * otherwise the message is not delivered and the caller decides how to
 * surface the link (development only). Tokens are never written to logs.
 */
export async function sendMail(input: MailInput): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { delivered: false };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}.`);
  }
  return { delivered: true };
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
