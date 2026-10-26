import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listBranches, listRoles } from "@/lib/users/service";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function InviteUserPage() {
  const session = await requirePagePermission(PERMISSIONS.userInvite, "/users/invite");
  const [roles, branches] = await Promise.all([listRoles(session), listBranches(session)]);
  const assignableRoles =
    session.membership.roleCode === "owner"
      ? roles
      : roles.filter((role) => role.code !== "owner" && role.code !== "admin");

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-muted">
        <Link className="hover:text-ink" href="/users">
          Pengguna
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-ink">Undang pengguna</span>
      </nav>

      <header className="mb-6">
        <p className="mb-1 text-[12px] uppercase tracking-wider text-muted">Tim &amp; Akses</p>
        <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-ink">
          Undang pengguna
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] leading-6 text-muted">
          Undangan membuat tautan sekali pakai. Pengguna menetapkan password sendiri melalui
          tautan tersebut; tidak ada password sementara yang dikirim.
        </p>
      </header>

      <InviteForm branches={branches} roles={assignableRoles} />

      <aside className="mt-4 rounded-panel border border-line bg-surface-muted p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] text-forest">info</span>
          <p className="text-[12px] leading-5 text-secondary">
            Hanya Owner yang dapat memberikan role Owner atau Admin. Role Manager hanya melihat
            pengguna pada cabang yang ditugaskan.
          </p>
        </div>
      </aside>
    </div>
  );
}
