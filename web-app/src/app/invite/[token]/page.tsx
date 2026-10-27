import Link from "next/link";
import { getInvitationForToken } from "@/lib/users/service";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

type DeadState = {
  title: string;
  body: string;
  icon: string;
};

function deadState(
  invitation: Awaited<ReturnType<typeof getInvitationForToken>>,
): DeadState {
  if (!invitation) {
    return {
      icon: "link_off",
      title: "Tautan undangan tidak valid",
      body: "Tautan ini tidak dikenali. Minta administrator toko membuatkan undangan baru.",
    };
  }
  if (invitation.status === "accepted") {
    return {
      icon: "task_alt",
      title: "Undangan sudah digunakan",
      body: "Akun untuk undangan ini sudah aktif. Silakan masuk dengan password Anda.",
    };
  }
  if (invitation.status === "revoked") {
    return {
      icon: "block",
      title: "Undangan telah dicabut",
      body: "Administrator mencabut undangan ini. Hubungi mereka jika Anda membutuhkan akses.",
    };
  }
  return {
    icon: "timer_off",
    title: "Tautan undangan kedaluwarsa",
    body: "Tautan undangan berlaku 7 hari sejak dibuat. Minta administrator membuatkan undangan baru.",
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationForToken(token);
  const expired =
    invitation !== null &&
    invitation.status === "pending" &&
    invitation.expiresAt.getTime() <= Date.now();
  const usable = invitation !== null && invitation.status === "pending" && !expired;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-2 focus-ring" href="/login">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-forest text-white">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">POS Admin</span>
        </Link>

        {usable ? (
          <section className="rounded-panel border border-line bg-surface p-8">
            <div className="mb-6">
              <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Undangan Tim</p>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                Selesaikan akun Anda
              </h1>
              <p className="mt-2 text-sm leading-6 text-secondary">
                <span className="font-semibold text-ink">{invitation.organizationName}</span>{" "}
                mengundang <span className="font-semibold text-ink">{invitation.name}</span> (
                {invitation.email}) bergabung ke POS Admin. Tetapkan password untuk mengaktifkan
                akun.
              </p>
            </div>
            <AcceptInviteForm token={token} />
          </section>
        ) : (
          <section className="rounded-panel border border-line bg-surface p-8 text-center">
            {(() => {
              const state = deadState(invitation);
              return (
                <>
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brick-bg text-brick">
                    <span className="material-symbols-outlined text-[24px]">{state.icon}</span>
                  </span>
                  <h1 className="text-xl font-semibold tracking-tight text-ink">{state.title}</h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-secondary">
                    {state.body}
                  </p>
                </>
              );
            })()}
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