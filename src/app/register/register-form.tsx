"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { ClientApiError, apiRequest } from "@/lib/client/api";

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Pontianak",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "UTC",
];

const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "PHP", "THB"];

export function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [currency, setCurrency] = useState("IDR");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organizationName = String(form.get("organizationName") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const errors: Record<string, string> = {};
    if (organizationName.length < 2) errors.organizationName = "Nama bisnis wajib diisi.";
    if (!name) errors.name = "Nama Anda wajib diisi.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Format email tidak valid.";
    const policyError = validatePasswordPolicy(password, { email, name });
    if (policyError) errors.password = policyError;
    if (password !== confirm) errors.confirm = "Konfirmasi password tidak sama.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setFormError(null);
    try {
      await apiRequest<{ redirectTo?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ organizationName, name, email, password, timezone, currency }),
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

  function fieldClass(field: string) {
    return `h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? "border-brick focus:border-brick focus:ring-brick/25"
        : "border-line focus:border-amber focus:ring-amber/30"
    }`;
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

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
        Nama bisnis
        <input
          autoFocus
          className={fieldClass("organizationName")}
          id="organizationName"
          maxLength={160}
          name="organizationName"
          placeholder="Contoh: Toko Sumber Rejeki"
        />
        {fieldErrors.organizationName ? (
          <span className="text-xs font-normal text-brick">{fieldErrors.organizationName}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
        Nama Anda
        <input
          autoComplete="name"
          className={fieldClass("name")}
          id="name"
          maxLength={120}
          name="name"
          placeholder="Nama pemilik"
        />
        {fieldErrors.name ? (
          <span className="text-xs font-normal text-brick">{fieldErrors.name}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
        Email
        <input
          autoComplete="username"
          className={fieldClass("email")}
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          placeholder="nama@toko.com"
          type="email"
        />
        {fieldErrors.email ? (
          <span className="text-xs font-normal text-brick">{fieldErrors.email}</span>
        ) : null}
      </label>

      <div className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
        <label htmlFor="password">Password</label>
        <div className="relative flex items-center">
          <input
            autoComplete="new-password"
            className={fieldClass("password")}
            id="password"
            maxLength={PASSWORD_MAX_LENGTH}
            name="password"
            placeholder={`Minimal ${PASSWORD_MIN_LENGTH} karakter`}
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-medium text-secondary hover:bg-black/5 hover:text-ink"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? "Sembunyikan" : "Lihat"}
          </button>
        </div>
        {fieldErrors.password ? (
          <span className="text-xs font-normal text-brick">{fieldErrors.password}</span>
        ) : (
          <span className="text-[11px] font-normal text-muted">
            Minimal {PASSWORD_MIN_LENGTH} karakter. Jangan gunakan email atau nama Anda.
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
        Ulangi password
        <input
          autoComplete="new-password"
          className={fieldClass("confirm")}
          id="confirm"
          maxLength={PASSWORD_MAX_LENGTH}
          name="confirm"
          placeholder="Ketik ulang password"
          type="password"
        />
        {fieldErrors.confirm ? (
          <span className="text-xs font-normal text-brick">{fieldErrors.confirm}</span>
        ) : null}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
          Zona waktu
          <select
            className="h-10 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
          Mata uang
          <select
            className="h-10 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest text-sm font-semibold text-white transition-colors hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-80"
        disabled={busy}
        type="submit"
      >
        {busy ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            Membuat akun...
          </>
        ) : (
          "Buat akun toko"
        )}
      </button>
    </form>
  );
}
