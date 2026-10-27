import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { homePathFor } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(homePathFor(session.membership.roleCode));
}
