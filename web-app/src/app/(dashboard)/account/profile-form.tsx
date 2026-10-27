"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, apiRequest } from "@/lib/client/api";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name, phone });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiRequest("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ClientApiError
          ? Object.values(cause.fields)[0] ?? cause.message
          : "Gagal menyimpan profil.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
        Nama
        <input
          className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
          maxLength={120}
          onChange={(event) => {
            setForm((current) => ({ ...current, name: event.target.value }));
            setSaved(false);
          }}
          required
          value={form.name}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
        Nomor telepon
        <input
          className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
          maxLength={30}
          onChange={(event) => {
            setForm((current) => ({ ...current, phone: event.target.value }));
            setSaved(false);
          }}
          placeholder="08xx xxxx xxxx"
          value={form.phone}
        />
      </label>
      {error ? <p className="text-[12px] text-brick">{error}</p> : null}
      {saved ? <p className="text-[12px] font-semibold text-success">Profil tersimpan.</p> : null}
      <button
        className="h-10 rounded-control bg-forest px-4 text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? "Menyimpan..." : "Simpan profil"}
      </button>
    </form>
  );
}
