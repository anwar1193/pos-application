"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { apiRequest, ClientApiError } from "@/lib/client/api";

export function ResetPasswordForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const errors: Record<string, string> = {};
    const policyError = validatePasswordPolicy(password);
    if (policyError) errors.password = policyError;
    if (password !== confirm) errors.confirm = "Konfirmasi password tidak sama.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setFormError(null);
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (cause) {
      if (cause instanceof ClientApiError) {
        setFieldErrors(cause.fields);
        if (Object.keys(cause.fields).length === 0) setFormError(cause.message);
      } else {
        setFormError("Terjadi kesalahan. Silakan coba lagi.");
      }
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-bg p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
          <span className="material-symbols-outlined text-[22px]">lock_reset</span>
        </span>
        <h2 className="text-base font-semibold text-ink">Password diperbarui</h2>
        <p className="mt-1 text-sm leading-6 text-secondary">
          Semua sesi lama dicabut. Silakan masuk dengan password baru Anda.
        </p>
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
          href="/login"
        >
          Masuk sekarang
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      {formError ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-brick/30 bg-brick-bg p-3 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined shrink-0 text-[16px]">error</span>
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="password">
          Password baru
        </label>
        <input
          aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
          aria-invalid={fieldErrors.password ? "true" : "false"}
          autoComplete="new-password"
          autoFocus
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink shadow-none transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
            fieldErrors.password
              ? "border-brick focus:border-brick focus:ring-brick/25"
              : "border-line focus:border-amber focus:ring-amber/30"
          }`}
          id="password"
          maxLength={128}
          name="password"
          placeholder={`Minimal ${PASSWORD_MIN_LENGTH} karakter`}
          type="password"
        />
        {fieldErrors.password ? (
          <p className="text-xs text-brick" id="password-error">
            {fieldErrors.password}
          </p>
        ) : (
          <p className="text-[11px] text-muted" id="password-hint">
            Minimal {PASSWORD_MIN_LENGTH} karakter. Jangan gunakan email atau nama Anda.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="confirm">
          Ulangi password
        </label>
        <input
          aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
          aria-invalid={fieldErrors.confirm ? "true" : "false"}
          autoComplete="new-password"
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink shadow-none transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
            fieldErrors.confirm
              ? "border-brick focus:border-brick focus:ring-brick/25"
              : "border-line focus:border-amber focus:ring-amber/30"
          }`}
          id="confirm"
          maxLength={128}
          name="confirm"
          placeholder="Ketik ulang password"
          type="password"
        />
        {fieldErrors.confirm ? (
          <p className="text-xs text-brick" id="confirm-error">
            {fieldErrors.confirm}
          </p>
        ) : null}
      </div>

      <button
        className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-80"
        disabled={busy}
        type="submit"
      >
        {busy ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            Memproses...
          </>
        ) : (
          "Simpan password baru"
        )}
      </button>
    </form>
  );
}