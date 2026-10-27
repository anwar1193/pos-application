import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-2 focus-ring" href="/login">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-forest text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
        </Link>

        <section className="rounded-panel border border-line bg-surface p-8">
          <div className="mb-6">
            <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Pemulihan akses</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Lupa password?</h1>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Masukkan email akun Anda. Jika terdaftar, kami mengirim tautan pengaturan ulang
              password yang berlaku 30 menit.
            </p>
          </div>
          <ForgotPasswordForm />
        </section>

        <p className="mt-6 text-center text-[12px] text-secondary">
          Ingat password Anda?{" "}
          <Link className="font-semibold text-forest hover:underline" href="/login">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
