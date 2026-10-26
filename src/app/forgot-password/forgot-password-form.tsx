"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientApiError, apiRequest } from "@/lib/client/api";

type Result = { message: string; resetUrl?: string };

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<Result>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setResult(data);
    } catch (cause) {
      setError(
        cause instanceof ClientApiError
          ? cause.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-success/30 bg-success-bg p-4 text-sm text-secondary">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined shrink-0 text-[20px] text-success">
              mark_email_read
            </span>
            <p className="leading-6">{result.message}</p>
          </div>
        </div>
        {result.resetUrl ? (
          <div className="rounded-lg border border-line bg-surface-muted p-3 text-xs text-secondary">
            <p className="font-semibold text-ink">Mode pengembangan</p>
            <p className="mt-1">Email tidak dikirim. Tautan reset tersedia langsung:</p>
            <Link
              className="mt-1 block break-all font-semibold text-forest underline"
              href={result.resetUrl}
            >
              {result.resetUrl}
            </Link>
          </div>
        ) : null}
        <Link
          className="flex h-11 w-full items-center justify-center rounded-lg border border-line bg-white text-sm font-semibold text-ink hover:bg-surface-muted"
          href="/login"
        >
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      {error ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-brick/30 bg-brick-bg p-3 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined shrink-0 text-[16px]">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink" htmlFor="email">
        Email
        <input
          autoComplete="username"
          autoFocus
          className="h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink transition-colors placeholder:text-muted focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
          id="email"
          inputMode="email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@toko.com"
          required
          type="email"
          value={email}
        />
      </label>

      <button
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-forest text-sm font-semibold text-white transition-colors hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-80"
        disabled={busy}
        type="submit"
      >
        {busy ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            Mengirim...
          </>
        ) : (
          "Kirim tautan reset"
        )}
      </button>
    </form>
  );
}
