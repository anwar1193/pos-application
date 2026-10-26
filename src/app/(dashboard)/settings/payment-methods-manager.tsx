"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, send } from "./request";

type Method = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type FormState = {
  code: string;
  name: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  sortOrder: "0",
  isActive: true,
};

export function PaymentMethodsManager({ methods }: { methods: Method[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Method | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(method: Method) {
    setEditing(method);
    setForm({
      code: method.code,
      name: method.name,
      sortOrder: String(method.sortOrder),
      isActive: method.isActive,
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
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editing) {
        await send(`/api/settings/payment-methods/${editing.id}`, "PATCH", body);
      } else {
        await send("/api/settings/payment-methods", "POST", body);
      }
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Gagal menyimpan metode pembayaran."));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(method: Method) {
    setBusy(method.id);
    setError(null);
    try {
      await send(`/api/settings/payment-methods/${method.id}`, "PATCH", {
        isActive: !method.isActive,
      });
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Gagal mengubah status metode."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Metode pembayaran</h2>
          <p className="text-[12px] text-muted">
            Metode aktif akan muncul sebagai pilihan pada layar kasir.
          </p>
        </div>
        <button
          className="flex h-9 items-center gap-2 rounded-control bg-forest px-3 text-[13px] font-semibold text-white hover:bg-forest-hover"
          onClick={openCreate}
          type="button"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>
          Metode baru
        </button>
      </div>

      {error && !open ? <p className="text-[12px] text-brick">{error}</p> : null}

      <section className="rounded-panel border border-line bg-surface">
        {methods.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">
            Belum ada metode pembayaran.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Urutan</th>
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">Kode</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr className="border-b border-line last:border-0" key={method.id}>
                    <td className="px-4 py-3 text-[12px] text-secondary">{method.sortOrder}</td>
                    <td className="px-4 py-3 text-[13px] font-medium text-ink">{method.name}</td>
                    <td className="px-4 py-3 text-[12px] text-secondary">{method.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          method.isActive
                            ? "bg-success-bg text-success"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {method.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-[12px] font-semibold text-forest underline"
                          onClick={() => openEdit(method)}
                          type="button"
                        >
                          Ubah
                        </button>
                        <button
                          className={`text-[12px] font-semibold underline disabled:opacity-50 ${
                            method.isActive ? "text-brick" : "text-forest"
                          }`}
                          disabled={busy === method.id}
                          onClick={() => void toggle(method)}
                          type="button"
                        >
                          {method.isActive ? "Nonaktifkan" : "Aktifkan"}
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
            className="relative w-full max-w-md rounded-panel border border-line bg-surface p-5 text-left shadow-overlay"
            onSubmit={submit}
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-ink">
              {editing ? `Ubah ${editing.name}` : "Metode pembayaran baru"}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Nama
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={120}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  value={form.name}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Kode
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  maxLength={40}
                  onChange={(event) => update("code", event.target.value)}
                  pattern="[a-z0-9_\-]+"
                  required
                  value={form.code}
                />
                <span className="text-[11px] font-normal text-muted">
                  Huruf kecil, angka, tanda hubung, atau garis bawah.
                </span>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
                Urutan tampil
                <input
                  className="h-9 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
                  max="999"
                  min="0"
                  onChange={(event) => update("sortOrder", event.target.value)}
                  type="number"
                  value={form.sortOrder}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                <input
                  checked={form.isActive}
                  onChange={(event) => update("isActive", event.target.checked)}
                  type="checkbox"
                />
                Aktif di layar kasir
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
