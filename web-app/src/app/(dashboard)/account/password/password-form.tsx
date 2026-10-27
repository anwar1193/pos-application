"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { apiRequest, ClientApiError } from "@/lib/client/api";

function inputClass(hasError: boolean): string {
  return `h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink shadow-none transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
    hasError
      ? "border-brick focus:border-brick focus:ring-brick/25"
      : "border-line focus:border-amber focus:ring-amber/30"
  }`;
}

export function PasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Password lama wajib diisi.";
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) errors.newPassword = policyError;
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = "Password baru harus berbeda dari password lama.";
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak sama.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setFormError(null);
    try {
      await apiRequest("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      router.replace("/dashboard");
      router.refresh();
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
        <label className="text-xs font-semibold text-ink" htmlFor="currentPassword">
          Password lama
        </label>
        <input
          aria-describedby={fieldErrors.currentPassword ? "currentPassword-error" : undefined}
          aria-invalid={fieldErrors.currentPassword ? "true" : "false"}
          autoComplete="current-password"
          className={inputClass(Boolean(fieldErrors.currentPassword))}
          id="currentPassword"
          maxLength={128}
          name="currentPassword"
          placeholder="Masukkan password saat ini"
          type="password"
        />
        {fieldErrors.currentPassword ? (
          <p className="text-xs text-brick" id="currentPassword-error">
            {fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="newPassword">
          Password baru
        </label>
        <input
          aria-describedby={
            fieldErrors.newPassword ? "newPassword-error" : "newPassword-hint"
          }
          aria-invalid={fieldErrors.newPassword ? "true" : "false"}
          autoComplete="new-password"
          className={inputClass(Boolean(fieldErrors.newPassword))}
          id="newPassword"
          maxLength={128}
          name="newPassword"
          placeholder="Minimal 12 karakter"
          type="password"
        />
        {fieldErrors.newPassword ? (
          <p className="text-xs text-brick" id="newPassword-error">
            {fieldErrors.newPassword}
          </p>
        ) : (
          <p className="text-[11px] text-muted" id="newPassword-hint">
            Minimal {PASSWORD_MIN_LENGTH} karakter. Jangan gunakan email atau nama Anda.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="confirmPassword">
          Ulangi password baru
        </label>
        <input
          aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
          aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
          autoComplete="new-password"
          className={inputClass(Boolean(fieldErrors.confirmPassword))}
          id="confirmPassword"
          maxLength={128}
          name="confirmPassword"
          placeholder="Ketik ulang password baru"
          type="password"
        />
        {fieldErrors.confirmPassword ? (
          <p className="text-xs text-brick" id="confirmPassword-error">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      <button
        className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-80"
        disabled={busy}
        type="submit"
      >
        {busy ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            Menyimpan...
          </>
        ) : (
          "Ganti password"
        )}
      </button>
    </form>
  );
}