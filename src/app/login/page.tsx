import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const session = await getCurrentSession();
  if (session) redirect(safeNextPath(params.next));

  return (
    <main className="flex min-h-screen flex-col bg-paper lg:flex-row">
      <section className="receipt-perforation relative hidden w-[42%] min-w-[480px] shrink-0 flex-col justify-between overflow-hidden bg-forest p-12 text-white select-none lg:flex xl:p-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <pattern id="ledger-grid" height="28" patternUnits="userSpaceOnUse" width="28">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#FFFFFF" strokeWidth="1" />
              </pattern>
            </defs>
            <rect fill="url(#ledger-grid)" height="100%" width="100%" />
          </svg>
        </div>

        <header className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-white/20 bg-white/10">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-none tracking-tight text-white">
                POS Admin
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
                Sistem Back-Office
              </span>
            </div>
          </div>
          <span className="inline-flex items-center rounded border border-white/10 bg-forest-hover px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Operasional Kasir
          </span>
        </header>

        <div className="relative z-10 my-auto max-w-lg py-8">
          <div className="mb-6 h-1 w-10 rounded-full bg-[#97D3B5]" />
          <h1 className="text-[42px] font-bold leading-[1.2] tracking-tight text-white">
            Satu tempat untuk mengelola toko, pengguna, dan akses.
          </h1>
          <p className="mt-5 max-w-md text-base font-normal leading-relaxed text-white/80">
            Pantau seluruh ekosistem ritel dengan disiplin buku kas fisik dan presisi digital
            terpadu.
          </p>
        </div>

        <footer className="relative z-10 flex flex-col gap-4 border-t border-white/10 pt-6">
          <div className="flex items-center gap-6 opacity-40" aria-hidden="true">
            {[0, 1].map((group) => (
              <div className="flex items-center gap-1.5" key={group}>
                {[0, 1, 2, 3].map((mark) => (
                  <span className="inline-block h-4 w-0.5 bg-white" key={mark} />
                ))}
                <span className="-ml-4 inline-block h-0.5 w-5 -rotate-45 bg-white" />
              </div>
            ))}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
              Buku kas operasional
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>POS Admin · Web Back-Office</span>
            <span className="flex items-center gap-1.5 text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Siap menerima sesi
            </span>
          </div>
        </footer>
      </section>

      <section className="flex min-h-screen flex-1 flex-col items-start justify-between bg-paper px-6 py-10 lg:px-16 lg:py-12 xl:px-24">
        <div className="flex w-full justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs text-secondary">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span>Terminal Pengelola</span>
          </div>
        </div>

        <div className="my-auto w-full max-w-[400px]">
          <div className="mb-6">
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              <span className="material-symbols-outlined text-forest">point_of_sale</span>
              <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-ink">Masuk ke POS Admin</h2>
            <p className="mt-1.5 text-sm text-secondary">Gunakan email dan password akun Anda.</p>
          </div>

          <LoginForm nextPath={safeNextPath(params.next)} />
        </div>

        <div className="flex w-full max-w-[400px] items-center gap-3 border-t border-line pt-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-moss text-forest">
            <span className="material-symbols-outlined text-[18px]">storefront</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-ink">Pusat kendali organisasi</span>
            <span className="text-[11px] leading-tight text-secondary">
              Akses terbatas untuk Owner, Admin, dan Manajer.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
