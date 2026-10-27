import Link from "next/link";
import { getResetTokenInfo } from "@/lib/users/service";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await getResetTokenInfo(token);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-2 focus-ring" href="/login">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-forest text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
        </Link>

        {info ? (
          <section className="rounded-panel border border-line bg-surface p-8">
            <div className="mb-6">
              <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Pemulihan Akses</p>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Atur ulang password</h1>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Buat password baru untuk akun{" "}
                <span className="font-semibold text-ink">{info.email}</span>. Seluruh sesi aktif
                pada akun ini akan dicabut setelah password diganti.
              </p>
            </div>
            <ResetPasswordForm token={token} />
          </section>
        ) : (
          <section className="rounded-panel border border-line bg-surface p-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brick-bg text-brick">
              <span className="material-symbols-outlined text-[24px]">timer_off</span>
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Tautan reset tidak valid
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-secondary">
              Tautan ini sudah dipakai atau kedaluwarsa dalam 30 menit. Minta administrator
              toko membuatkan tautan baru.
            </p>
            <Link
              className="mt-6 inline-flex h-10 items-center justify-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-ring"
              href="/login"
            >
              Kembali ke halaman masuk
            </Link>
          </section>
        )}

        <p className="mt-6 text-center text-[11px] leading-5 text-muted">
          Butuh bantuan? Hubungi administrator toko Anda.
        </p>
      </div>
    </main>
  );
}