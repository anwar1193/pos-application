"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, send } from "./request";

const TIMEZONES = [
  "UTC",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Pontianak",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Manila",
  "Australia/Sydney",
];

const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "PHP", "THB", "AUD", "EUR"];

type Organization = {
  name: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  receiptPrefix: string;
  taxRate: number;
  allowNegativeStock: boolean;
  slug: string;
};

export function OrganizationForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: organization.name,
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    timezone: organization.timezone,
    currency: organization.currency,
    receiptPrefix: organization.receiptPrefix,
    taxRate: String(organization.taxRate / 100),
  });
  const [allowNegativeStock, setAllowNegativeStock] = useState(
    organization.allowNegativeStock,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const timezoneOptions = TIMEZONES.includes(form.timezone)
    ? TIMEZONES
    : [form.timezone, ...TIMEZONES];
  const currencyOptions = CURRENCIES.includes(form.currency)
    ? CURRENCIES
    : [form.currency, ...CURRENCIES];

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const taxRate = Math.round((Number(form.taxRate) || 0) * 100);
      if (taxRate < 0 || taxRate > 10_000) {
        throw new Error("Tarif pajak harus antara 0 dan 100%.");
      }
      await send("/api/settings/organization", "PATCH", {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        timezone: form.timezone,
        currency: form.currency.toUpperCase(),
        receiptPrefix: form.receiptPrefix.trim(),
        taxRate,
        allowNegativeStock,
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Gagal menyimpan pengaturan."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" onSubmit={submit}>
      <section className="rounded-panel border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-ink">Profil bisnis</h2>
        <p className="mt-1 text-[12px] text-muted">
          Nama dan kontak ini tampil pada struk dan dokumen.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
            Nama bisnis
            <input
              className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
              maxLength={160}
              onChange={(event) => update("name", event.target.value)}
              required
              value={form.name}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Telepon
            <input
              className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
              maxLength={30}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="08xx xxxx xxxx"
              value={form.phone}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Kode unik bisnis
            <input
              className="h-10 rounded-control border border-line bg-surface-muted px-3 text-[13px] font-normal text-muted"
              disabled
              value={organization.slug}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink sm:col-span-2">
            Alamat
            <textarea
              className="rounded-control border border-line px-3 py-2 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
              maxLength={1000}
              onChange={(event) => update("address", event.target.value)}
              rows={3}
              value={form.address}
            />
          </label>
        </div>
      </section>

      <section className="rounded-panel border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-ink">Operasional</h2>
        <p className="mt-1 text-[12px] text-muted">
          Zona waktu dan mata uang dipakai untuk seluruh laporan.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Zona waktu
            <select
              className="h-10 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
              onChange={(event) => update("timezone", event.target.value)}
              value={form.timezone}
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Mata uang
            <select
              className="h-10 rounded-control border border-line bg-white px-2 text-[13px] font-normal text-ink"
              onChange={(event) => update("currency", event.target.value)}
              value={form.currency}
            >
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Prefiks nomor struk
            <input
              className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
              maxLength={20}
              onChange={(event) => update("receiptPrefix", event.target.value)}
              value={form.receiptPrefix}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink">
            Pajak penjualan (%)
            <input
              className="h-10 rounded-control border border-line px-3 text-[13px] font-normal text-ink focus:border-forest focus:outline-none"
              max="100"
              min="0"
              onChange={(event) => update("taxRate", event.target.value)}
              step="0.01"
              type="number"
              value={form.taxRate}
            />
            <span className="text-[11px] font-normal text-muted">
              Dipakai sebagai nilai awal pajak pada transaksi baru.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-line px-3 py-2">
            <input
              checked={allowNegativeStock}
              className="mt-0.5"
              onChange={(event) => {
                setAllowNegativeStock(event.target.checked);
                setSaved(false);
              }}
              type="checkbox"
            />
            <span className="text-[12px]">
              <span className="block font-semibold text-ink">
                Izinkan stok negatif
              </span>
              <span className="block text-[11px] text-muted">
                Jika dimatikan, penjualan dan penyesuaian akan ditolak saat stok tidak cukup.
              </span>
            </span>
          </label>
        </div>
        {error ? <p className="mt-3 text-[12px] text-brick">{error}</p> : null}
        {saved ? (
          <p className="mt-3 text-[12px] font-semibold text-success">Pengaturan tersimpan.</p>
        ) : null}
        <button
          className="mt-4 h-10 w-full rounded-control bg-forest text-[13px] font-semibold text-white hover:bg-forest-hover disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
      </section>
    </form>
  );
}
