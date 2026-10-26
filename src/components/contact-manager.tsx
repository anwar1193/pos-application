"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
};

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active",
};

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: { id?: string }; error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok) {
    const field = payload?.error?.fields ? Object.values(payload.error.fields)[0] : undefined;
    throw new Error(field ?? payload?.error?.message ?? "Permintaan gagal.");
  }
  return payload?.data;
}

const COPY = {
  customer: { singular: "Pelanggan", plural: "pelanggan", base: "/api/customers" },
  supplier: { singular: "Supplier", plural: "supplier", base: "/api/suppliers" },
} as const;

export function ContactManager({
  kind,
  canManage,
  mode,
  target,
}: {
  kind: "customer" | "supplier";
  canManage: boolean;
  mode: "create" | "edit";
  target?: ContactRow;
}) {
  const router = useRouter();
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(
    target
      ? {
          name: target.name,
          phone: target.phone ?? "",
          email: target.email ?? "",
          address: target.address ?? "",
          notes: target.notes ?? "",
          status: target.status,
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canManage) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        name: form.name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status as "active" | "archived",
      };
      if (mode === "create") {
        await send(copy.base, "POST", body);
      } else if (target) {
        await send(`${copy.base}/${target.id}`, "PATCH", body);
      }
      setOpen(false);
      if (mode === "create") setForm(EMPTY);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Gagal menyimpan ${copy.plural}.`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    if (!target) return;
    const nextStatus = target.status === "active" ? "archived" : "active";
    if (
      nextStatus === "archived" &&
      !window.confirm(`Arsipkan ${copy.plural} ${target.name}? Riwayat transaksi tetap tersimpan.`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send(`${copy.base}/${target.id}`, "PATCH", { status: nextStatus });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengubah status.");
      setNotice(cause instanceof Error ? cause.message : null);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {mode === "create" ? (
        <button
          className="flex h-10 items-center gap-2 rounded-control bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover"
          onClick={() => {
            setError(null);
            setNotice(null);
            setOpen(true);
          }}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {copy.singular}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-[11px] font-semibold text-forest hover:bg-moss disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              setError(null);
              setNotice(null);
              setOpen(true);
            }}
            type="button"
          >
            Ubah
          </button>
          <button
            className={`rounded px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
              target?.status === "active"
                ? "text-brick hover:bg-brick-bg"
                : "text-forest hover:bg-moss"
            }`}
            disabled={busy}
            onClick={() => void toggleArchive()}
            type="button"
          >
            {target?.status === "active" ? "Arsip" : "Aktifkan"}
          </button>
        </span>
      )}

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            aria-label="Tutup"
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-overlay"
            onSubmit={submit}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {mode === "create" ? `${copy.singular} baru` : `Ubah ${copy.plural}`}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
                Nama
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                  required
                  value={form.name}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Telepon
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))}
                  value={form.phone}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Email
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
                Alamat
                <textarea
                  className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, address: event.target.value }))
                  }
                  rows={2}
                  value={form.address}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
                Catatan
                <textarea
                  className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
                  rows={2}
                  value={form.notes}
                />
              </label>
              {mode === "edit" ? (
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                  Status
                  <select
                    className="h-9 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
                    onChange={(event) =>
                      setForm((value) => ({ ...value, status: event.target.value }))
                    }
                    value={form.status}
                  >
                    <option value="active">Aktif</option>
                    <option value="archived">Arsip</option>
                  </select>
                </label>
              ) : null}
            </div>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
            {notice ? <p className="mt-2 text-[12px] text-brick">{notice}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-9 rounded-control border border-line px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                onClick={() => setOpen(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="h-9 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
