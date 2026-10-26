import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { homePathFor } from "@/lib/auth/permissions";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getCurrentSession();
  if (session) redirect(homePathFor(session.membership.roleCode));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-lg">
        <Link className="mb-8 flex items-center justify-center gap-2 focus-ring" href="/login">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-forest text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
        </Link>

        <section className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          <div className="mb-6">
            <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Daftar bisnis</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Buat akun toko</h1>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Akun pertama menjadi Owner dengan akses penuh. Cabang utama dibuat otomatis dan
              dapat diubah di pengaturan.
            </p>
          </div>
          <RegisterForm />
        </section>

        <p className="mt-6 text-center text-[12px] text-secondary">
          Sudah punya akun?{" "}
          <Link className="font-semibold text-forest hover:underline" href="/login">
            Masuk di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
