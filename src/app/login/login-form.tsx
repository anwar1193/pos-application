"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas";

type ApiErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", next: nextPath },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, next: nextPath }),
        credentials: "same-origin",
      });
      const body = (await response.json()) as ApiErrorBody & {
        data?: { redirectTo?: string };
      };
      if (!response.ok) {
        setFormError(body.error?.message ?? "Terjadi kesalahan. Silakan coba lagi.");
        resetField("password");
        return;
      }
      router.replace(body.data?.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setFormError("Terjadi kesalahan. Silakan coba lagi.");
      resetField("password");
    }
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-brick/30 bg-brick-bg p-3.5 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]">error</span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">Autentikasi terkendala</span>
            <span className="mt-0.5 leading-snug text-brick/90">{formError}</span>
          </div>
          <button
            aria-label="Tutup peringatan"
            className="ml-auto text-brick hover:opacity-75 focus-ring"
            onClick={() => setFormError(null)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          className="flex items-center justify-between text-xs font-semibold text-ink"
          htmlFor="email"
        >
          <span>Email</span>
          <span className="text-[11px] font-normal text-secondary">Format bisnis terdaftar</span>
        </label>
        <input
          {...register("email")}
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={errors.email ? "true" : "false"}
          autoComplete="username"
          autoFocus
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink shadow-none transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
            errors.email
              ? "border-brick focus:border-brick focus:ring-brick/25"
              : "border-line focus:border-amber focus:ring-amber/30"
          }`}
          id="email"
          inputMode="email"
          maxLength={254}
          placeholder="nama@toko.com"
          type="email"
        />
        {errors.email ? (
          <p className="text-xs text-brick" id="email-error">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-ink" htmlFor="password">
          Password
        </label>
        <div className="relative flex items-center">
          <input
            {...register("password")}
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={errors.password ? "true" : "false"}
            autoComplete="current-password"
            className={`h-11 w-full rounded-lg border bg-white py-2 pl-3.5 pr-24 text-sm text-ink shadow-none transition-colors placeholder:text-muted focus:outline-none focus:ring-2 ${
              errors.password
                ? "border-brick focus:border-brick focus:ring-brick/25"
                : "border-line focus:border-amber focus:ring-amber/30"
            }`}
            id="password"
            maxLength={128}
            placeholder="Masukkan kata sandi"
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-black/5 hover:text-ink focus-ring"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
            <span>{showPassword ? "Sembunyikan" : "Lihat"}</span>
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-brick" id="password-error">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest text-sm font-semibold text-white shadow-none transition-colors hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-80"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
            Memverifikasi...
          </>
        ) : (
          "Masuk"
        )}
      </button>

      <div className="flex items-center justify-between pt-1 text-xs text-secondary">
        <span>Lupa password?</span>
        <a
          className="rounded font-semibold text-forest hover:underline focus-ring"
          href="mailto:admin@demostore.id?subject=Bantuan%20Akses%20POS%20Admin"
        >
          Hubungi administrator toko.
        </a>
      </div>
    </form>
  );
}
