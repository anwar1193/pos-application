"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, send } from "./request";

type Branch = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
};

type FormState = {
  name: string;
  code: string;
  phone: string;
  address: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  code: "",
  phone: "",
  address: "",
  isActive: true,
};

export function BranchesManager({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      phone: branch.phone ?? "",
      address: branch.address ?? "",
      isActive: branch.isActive,
    });
    setError(null);
    setOpen(true);
  }

  function update(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        isActive: form.isActive,
      };
      if (editing) {
        await send(`/api/settings/branches/${editing.id}`, "PATCH", body);
      } else {
        await send("/api/settings/branches", "POST", body);
      }
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Gagal menyimpan cabang."));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(branch: Branch) {
    const next = !branch.isActive;
    if (!next && !window.confirm(`Nonaktifkan cabang ${branch.name}?`)) return;
    setBusy(branch.id);
    setError(null);
    try {
      await send(`/api/settings/branches/${branch.id}`, "PATCH", { isActive: next });
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Gagal mengubah status cabang."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Cabang</h2>
          <p className="text-[12px] text-muted">
            Setiap cabang punya stok, shift, dan laporan sendiri.
          </p>
        </div>
        <button
          className="flex h-9 items-center gap-2 rounded-control bg-forest px-3 text-[13px] font-semibold text-white hover:bg-forest-hover"
          onClick={openCreate}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>
          Cabang baru
        </button>
      </div>

      {error && !open ? <p className="text-[12px] text-brick">{error}</p> : null}

      <section className="rounded-panel border border-line bg-surface">
        {branches.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">
            Belum ada cabang. Tambahkan cabang pertama untuk mulai berjualan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Kode</th>
                  <th className="px-4 py-3 font-semibold">Telepon</th>
                  <th className="px-4 py-3 font-semibold">Alamat</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr className="border-b border-line last:border-0" key={branch.id}>
                    <td className="px-4 py-3 text-[13px] font-medium text-ink">{branch.name}</td>
                    <td className="px-4 py-3 text-[12px] text-secondary">{branch.code}</td>
                    <td className="px-4 py-3 text-[12px] text-secondary">
                      {branch.phone ?? "—"}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-[12px] text-secondary">
                      {branch.address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          branch.isActive
                            ? "bg-success-bg text-success"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {branch.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-[12px] font-semibold text-forest underline"
                          onClick={() => openEdit(branch)}
                          type="button"
                        >
                          Ubah
                        </button>
                        <button
                          className={`text-[12px] font-semibold underline disabled:opacity-50 ${
                            branch.isActive ? "text-brick" : "text-forest"
                          }`}
                          disabled={busy === branch.id}
                          onClick={() => void toggle(branch)}
                          type="button"
                        >
                          {branch.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-5 text-left shadow-overlay"
            onSubmit={submit}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {editing ? `Ubah ${editing.name}` : "Cabang baru"}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Nama cabang
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={160}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  value={form.name}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Kode
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal uppercase text-ink focus:border-forest focus:outline-none"
                  maxLength={30}
                  onChange={(event) => update("code", event.target.value)}
                  required
                  value={form.code}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Telepon
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={30}
                  onChange={(event) => update("phone", event.target.value)}
                  value={form.phone}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Alamat
                <textarea
                  className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={1000}
                  onChange={(event) => update("address", event.target.value)}
                  rows={3}
                  value={form.address}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                <input
                  checked={form.isActive}
                  onChange={(event) => update("isActive", event.target.checked)}
                  type="checkbox"
                />
                Cabang aktif
              </label>
            </div>
            {error ? <p className="mt-2 text-[12px] text-brick">{error}</p> : null}
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
                disabled={busy === "save"}
                type="submit"
              >
                {busy === "save" ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
