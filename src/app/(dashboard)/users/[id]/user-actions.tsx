"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, ClientApiError } from "@/lib/client/api";

type ConfirmKind = "deactivate" | "revokeSessions" | "revokeInvite";

type ResetResult = { resetUrl: string; expiresAt: string };

const CONFIRM_COPY: Record<ConfirmKind, { title: string; body: string; confirm: string }> = {
  deactivate: {
    title: "Nonaktifkan pengguna?",
    body: "Akun tidak dapat masuk sampai diaktifkan kembali. Seluruh sesi aktif pada organisasi ini akan dicabut.",
    confirm: "Ya, nonaktifkan",
  },
  revokeSessions: {
    title: "Cabut semua sesi?",
    body: "Pengguna harus masuk kembali di setiap perangkat. Password dan data akun tidak berubah.",
    confirm: "Ya, cabut sesi",
  },
  revokeInvite: {
    title: "Cabut undangan?",
    body: "Tautan undangan yang belum dipakai akan berhenti berlaku. Pengguna perlu diundang ulang.",
    confirm: "Ya, cabut undangan",
  },
};

export function UserActions({
  userId,
  name,
  status,
  activeSessions,
  pendingInvitationId,
  canDeactivate,
  canResetPassword,
  canRevokeSessions,
  canRevokeInvite,
  isSelf,
}: {
  userId: string;
  name: string;
  status: "active" | "invited" | "suspended";
  activeSessions: number;
  pendingInvitationId: string | null;
  canDeactivate: boolean;
  canResetPassword: boolean;
  canRevokeSessions: boolean;
  canRevokeInvite: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function execute(kind: ConfirmKind | "reactivate" | "reset") {
    setBusy(kind);
    setError(null);
    setCopied(false);
    try {
      if (kind === "deactivate") {
        await apiRequest(`/api/users/${userId}/deactivate`, { method: "POST" });
      } else if (kind === "reactivate") {
        await apiRequest(`/api/users/${userId}/reactivate`, { method: "POST" });
      } else if (kind === "revokeSessions") {
        await apiRequest(`/api/users/${userId}/sessions/revoke`, { method: "POST" });
      } else if (kind === "revokeInvite" && pendingInvitationId) {
        await apiRequest(`/api/invitations/${pendingInvitationId}`, { method: "DELETE" });
      } else if (kind === "reset") {
        const result = await apiRequest<ResetResult>(`/api/users/${userId}/password-reset`, {
          method: "POST",
        });
        setResetResult(result);
        setConfirmKind(null);
        setBusy(null);
        return;
      }
      setConfirmKind(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ClientApiError
          ? cause.message
          : "Tindakan gagal. Silakan coba lagi.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function copyResetLink() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.resetUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const hasAnyAction =
    (canDeactivate && (status === "active" || status === "suspended")) ||
    canResetPassword ||
    (canRevokeSessions && activeSessions > 0) ||
    (canRevokeInvite && status === "invited" && pendingInvitationId);

  return (
    <section className="rounded-panel border border-line bg-surface p-6">
      <h2 className="text-xl font-semibold tracking-tight text-ink">Keamanan akun</h2>
      <p className="mt-0.5 text-[12px] text-muted">
        Tindakan sensitif tercatat pada audit log organisasi.
      </p>

      {error ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-control border border-brick/30 bg-brick-bg p-3.5 text-xs text-brick"
          role="alert"
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]">error</span>
          <p className="leading-snug">{error}</p>
        </div>
      ) : null}

      {isSelf ? (
        <p className="mt-4 rounded-control bg-surface-muted p-3 text-[12px] leading-5 text-secondary">
          Ini adalah akun Anda. Perubahan role dan penonaktifan akun sendiri tidak tersedia. Untuk
          ganti password, gunakan menu profil.
        </p>
      ) : null}

      {!hasAnyAction ? (
        <p className="mt-4 rounded-control bg-surface-muted p-3 text-[12px] leading-5 text-secondary">
          Tidak ada tindakan yang tersedia untuk akun ini pada role Anda.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {canDeactivate && status === "active" ? (
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-brick/30 bg-white px-4 text-sm font-semibold text-brick hover:bg-brick-bg focus-ring disabled:opacity-70"
              disabled={busy !== null}
              onClick={() => {
                setError(null);
                setConfirmKind("deactivate");
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">person_off</span>
              Nonaktifkan pengguna
            </button>
          ) : null}

          {canDeactivate && status === "suspended" ? (
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring disabled:opacity-70"
              disabled={busy !== null}
              onClick={() => execute("reactivate")}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              {busy === "reactivate" ? "Mengaktifkan..." : "Aktifkan kembali"}
            </button>
          ) : null}

          {canResetPassword ? (
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring disabled:opacity-70"
              disabled={busy !== null}
              onClick={() => execute("reset")}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              {busy === "reset" ? "Membuat tautan..." : "Buat tautan reset password"}
            </button>
          ) : null}

          {canRevokeSessions && activeSessions > 0 ? (
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring disabled:opacity-70"
              disabled={busy !== null}
              onClick={() => {
                setError(null);
                setConfirmKind("revokeSessions");
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">devices_off</span>
              Cabut {activeSessions} sesi aktif
            </button>
          ) : null}

          {canRevokeInvite && status === "invited" && pendingInvitationId ? (
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring disabled:opacity-70"
              disabled={busy !== null}
              onClick={() => {
                setError(null);
                setConfirmKind("revokeInvite");
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">mail_off</span>
              Cabut undangan tertunda
            </button>
          ) : null}
        </div>
      )}

      {resetResult ? (
        <div className="mt-4 rounded-control border border-line bg-paper p-3">
          <p className="text-[12px] font-semibold text-ink">Tautan reset password</p>
          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-secondary">
            {resetResult.resetUrl}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Berlaku sampai{" "}
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(resetResult.expiresAt))}
            . Tautan hanya ditampilkan sekali.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              className="flex h-8 items-center gap-1.5 rounded-control bg-forest px-3 text-[12px] font-semibold text-white hover:bg-forest-hover focus-ring"
              onClick={copyResetLink}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Tersalin" : "Salin"}
            </button>
            <button
              className="h-8 rounded-control px-3 text-[12px] font-medium text-muted hover:bg-surface-muted hover:text-ink focus-ring"
              onClick={() => setResetResult(null)}
              type="button"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}

      {confirmKind ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            aria-label="Tutup dialog"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setConfirmKind(null)}
            type="button"
          />
          <div
            aria-labelledby="confirm-title"
            aria-modal="true"
            className="relative w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-overlay"
            role="dialog"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brick-bg text-brick">
                <span className="material-symbols-outlined">
                  {confirmKind === "deactivate"
                    ? "person_off"
                    : confirmKind === "revokeInvite"
                      ? "mail_off"
                      : "devices_off"}
                </span>
              </span>
              <div>
                <h3 className="text-xl font-semibold text-ink" id="confirm-title">
                  {CONFIRM_COPY[confirmKind].title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {confirmKind === "revokeInvite" ? CONFIRM_COPY[confirmKind].body : `${name}: ${CONFIRM_COPY[confirmKind].body}`}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="h-10 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
                disabled={busy !== null}
                onClick={() => setConfirmKind(null)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-10 rounded-control bg-brick px-4 text-sm font-semibold text-white hover:bg-[#911E14] focus-ring disabled:opacity-70"
                disabled={busy !== null}
                onClick={() => execute(confirmKind)}
                type="button"
              >
                {busy === confirmKind ? "Memproses..." : CONFIRM_COPY[confirmKind].confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
