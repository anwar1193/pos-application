import { requirePageSession } from "@/lib/auth/guard";
import { initials } from "@/lib/format";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  const session = await requirePageSession("/account/password");

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Akun &amp; Keamanan</p>
        <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">
          Ganti password
        </h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-muted">
          Setelah password diganti, seluruh sesi lain pada organisasi ini dicabut. Anda tetap
          masuk di perangkat ini.
        </p>
      </header>

      <section className="rounded-panel border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-line pb-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moss text-[13px] font-semibold text-forest">
            {initials(session.user.name)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{session.user.name}</span>
            <span className="truncate text-[12px] text-muted">{session.user.email}</span>
          </div>
          <span className="ml-auto rounded-full bg-moss px-2.5 py-1 text-[11px] font-medium text-ink">
            {session.membership.roleName}
          </span>
        </div>
        <PasswordForm />
      </section>
    </div>
  );
}