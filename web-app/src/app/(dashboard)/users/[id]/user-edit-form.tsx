"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, ClientApiError } from "@/lib/client/api";

type Role = { id: string; code: string; name: string };
type Branch = { id: string; name: string; code: string };

export function UserEditForm({
  userId,
  user,
  roles,
  branches,
  canEditRole,
  isSelf,
}: {
  userId: string;
  user: { name: string; phone: string | null; roleId: string; branchId: string | null };
  roles: Role[];
  branches: Branch[];
  canEditRole: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    setFormError(null);
    setFieldErrors({});
    try {
      const payload: Record<string, unknown> = {
        name: String(form.get("name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim() || null,
        defaultBranchId: String(form.get("defaultBranchId") ?? "") || null,
      };
      if (canEditRole && !isSelf) payload.roleId = String(form.get("roleId") ?? "");
      await apiRequest(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSaved(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("Perubahan gagal disimpan. Silakan coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  const inputClass = (field: string) =>
    `h-10 rounded-control border bg-white px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? "border-brick focus:border-brick focus:ring-brick/25"
        : "border-line focus:border-amber focus:ring-amber/30"
    }`;

  return (
    <form className="rounded-panel border border-line bg-surface p-6" noValidate onSubmit={onSubmit}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Data pengguna</h2>
          <p className="mt-0.5 text-[12px] text-muted">Perubahan berlaku setelah disimpan.</p>
        </div>
        {saved ? (
          <span className="flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-medium text-success">
            <span className="material-symbols-outlined text-[14px]">check</span>
            Tersimpan
          </span>
        ) : null}
      </div>

      {formError ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-control border border-brick/30 bg-brick-bg p-3.5 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]">error</span>
          <p className="leading-snug">{formError}</p>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="name">
            Nama lengkap
          </label>
          <input
            aria-invalid={fieldErrors.name ? "true" : "false"}
            className={inputClass("name")}
            defaultValue={user.name}
            id="name"
            maxLength={120}
            name="name"
            required
            type="text"
          />
          {fieldErrors.name ? <p className="text-xs text-brick">{fieldErrors.name}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="phone">
            Nomor telepon
          </label>
          <input
            aria-invalid={fieldErrors.phone ? "true" : "false"}
            className={inputClass("phone")}
            defaultValue={user.phone ?? ""}
            id="phone"
            maxLength={30}
            name="phone"
            placeholder="Opsional"
            type="tel"
          />
          {fieldErrors.phone ? <p className="text-xs text-brick">{fieldErrors.phone}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="roleId">
            Role
          </label>
          <select
            aria-invalid={fieldErrors.roleId ? "true" : "false"}
            className={`${inputClass("roleId")} disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted`}
            defaultValue={user.roleId}
            disabled={!canEditRole || isSelf}
            id="roleId"
            name="roleId"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="text-[11px] text-muted">
              Anda tidak dapat mengubah role akun sendiri.
            </p>
          ) : !canEditRole ? (
            <p className="text-[11px] text-muted">
              Hanya Owner yang dapat mengelola role Owner atau Admin.
            </p>
          ) : fieldErrors.roleId ? (
            <p className="text-xs text-brick">{fieldErrors.roleId}</p>
          ) : (
            <p className="text-[11px] text-muted">Perubahan role mencabut sesi aktif pengguna.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink" htmlFor="defaultBranchId">
            Cabang utama
          </label>
          <select
            aria-invalid={fieldErrors.defaultBranchId ? "true" : "false"}
            className={inputClass("defaultBranchId")}
            defaultValue={user.branchId ?? ""}
            id="defaultBranchId"
            name="defaultBranchId"
          >
            <option value="">Tanpa cabang default</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {fieldErrors.defaultBranchId ? (
            <p className="text-xs text-brick">{fieldErrors.defaultBranchId}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t border-line pt-4">
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
              Menyimpan...
            </>
          ) : (
            "Simpan perubahan"
          )}
        </button>
      </div>
    </form>
  );
}
