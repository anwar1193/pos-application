import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { initials } from "@/lib/format";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requirePageSession("/account");

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Akun &amp; Keamanan</p>
        <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">Profil saya</h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-muted">
          Perbarui nama dan nomor telepon yang tampil pada aktivitas dan struk.
        </p>
      </header>

      <section className="rounded-panel border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-line pb-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-moss text-[14px] font-semibold text-forest">
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

        <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted">Organisasi</dt>
            <dd className="text-[13px] font-medium text-ink">{session.organization.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted">Peran</dt>
            <dd className="text-[13px] font-medium text-ink">{session.membership.roleName}</dd>
          </div>
        </dl>

        <ProfileForm name={session.user.name} phone={session.user.phone ?? ""} />

        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-muted">Ingin mengganti password?</p>
          <Link
            className="flex h-9 items-center justify-center gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-paper"
            href="/account/password"
          >
            <span className="material-symbols-outlined text-[17px]">key</span>
            Ganti password
          </Link>
        </div>
      </section>
    </div>
  );
}
