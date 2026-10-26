"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest, ClientApiError } from "@/lib/client/api";

type Role = { id: string; code: string; name: string };
type Branch = { id: string; name: string; code: string };

type InviteResult = {
  invitationId: string;
  inviteUrl: string;
  expiresAt: string;
};

export function InviteForm({ roles, branches }: { roles: Role[]; branches: Branch[] }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const data = await apiRequest<InviteResult>("/api/users/invitations", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          roleId: String(form.get("roleId") ?? ""),
          branchId: String(form.get("branchId") ?? "") || null,
        }),
      });
      setResult(data);
      setCopied(false);
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("Undangan gagal dibuat. Silakan coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-panel border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
            <span className="material-symbols-outlined">mark_email_read</span>
          </span>
          <div>
            <h2 className="text-xl font-semibold text-ink">Undangan siap dikirim</h2>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Kirim tautan ini melalui kanal tepercaya. Tautan hanya dapat dipakai sekali dan
              berlaku sampai{" "}
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(result.expiresAt))}
              .
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-control border border-line bg-paper p-3">
          <p className="break-all font-mono text-[12px] leading-5 text-ink">{result.inviteUrl}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring"
            onClick={copyLink}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Tersalin" : "Salin tautan"}
          </button>
          <Link
            className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
            href="/users"
          >
            Kembali ke daftar pengguna
          </Link>
        </div>
        <p className="mt-4 text-[12px] leading-5 text-muted">
          Tautan tidak ditampilkan lagi setelah halaman ini ditutup. Jika hilang, cabut undangan
          dan buat ulang.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-panel border border-line bg-surface p-6"
      noValidate
      onSubmit={onSubmit}
    >
      {formError ? (
        <div
          className="mb-5 flex items-start gap-3 rounded-control border border-brick/30 bg-brick-bg p-3.5 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]">error</span>
          <p className="leading-snug">{formError}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="name">
            Nama lengkap
          </label>
          <input
            aria-invalid={fieldErrors.name ? "true" : "false"}
            className={`h-10 rounded-control border bg-white px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
              fieldErrors.name
                ? "border-brick focus:border-brick focus:ring-brick/25"
                : "border-line focus:border-amber focus:ring-amber/30"
            }`}
            id="name"
            maxLength={120}
            name="name"
            placeholder="Nama pengguna"
            required
            type="text"
          />
          {fieldErrors.name ? <p className="text-xs text-brick">{fieldErrors.name}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="email">
            Email
          </label>
          <input
            aria-invalid={fieldErrors.email ? "true" : "false"}
            className={`h-10 rounded-control border bg-white px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
              fieldErrors.email
                ? "border-brick focus:border-brick focus:ring-brick/25"
                : "border-line focus:border-amber focus:ring-amber/30"
            }`}
            id="email"
            maxLength={254}
            name="email"
            placeholder="nama@toko.com"
            required
            type="email"
          />
          {fieldErrors.email ? <p className="text-xs text-brick">{fieldErrors.email}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="roleId">
            Role
          </label>
          <select
            aria-invalid={fieldErrors.roleId ? "true" : "false"}
            className={`h-10 rounded-control border bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 ${
              fieldErrors.roleId
                ? "border-brick focus:border-brick focus:ring-brick/25"
                : "border-line focus:border-amber focus:ring-amber/30"
            }`}
            defaultValue=""
            id="roleId"
            name="roleId"
            required
          >
            <option disabled value="">
              Pilih role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {fieldErrors.roleId ? (
            <p className="text-xs text-brick">{fieldErrors.roleId}</p>
          ) : (
            <p className="text-[11px] text-muted">Role menentukan izin akses di Web Admin.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="branchId">
            Cabang utama
          </label>
          <select
            aria-invalid={fieldErrors.branchId ? "true" : "false"}
            className={`h-10 rounded-control border bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 ${
              fieldErrors.branchId
                ? "border-brick focus:border-brick focus:ring-brick/25"
                : "border-line focus:border-amber focus:ring-amber/30"
            }`}
            defaultValue=""
            id="branchId"
            name="branchId"
          >
            <option value="">Tanpa cabang default</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {fieldErrors.branchId ? (
            <p className="text-xs text-brick">{fieldErrors.branchId}</p>
          ) : (
            <p className="text-[11px] text-muted">Opsional. Dapat diubah setelah akun aktif.</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Link
          className="flex h-10 items-center justify-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
          href="/users"
        >
          Batal
        </Link>
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover focus-ring disabled:cursor-not-allowed disabled:opacity-70"
          disabled={busy}
          type="submit"
        >
          {busy ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
              Membuat undangan...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Buat undangan
            </>
          )}
        </button>
      </div>
    </form>
  );
}
