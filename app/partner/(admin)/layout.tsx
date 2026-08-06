import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPartnerContext } from "@/lib/partner/context";
import { PartnerNav } from "./_components/PartnerNav";

export default async function PartnerAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/partner/login");
  }

  // Resolves every membership and picks the active one (cookie, validated).
  const ctx = await getPartnerContext();
  if (!ctx) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-base-200">
      <PartnerNav
        partner={ctx.active.partner}
        role={ctx.active.role}
        memberships={ctx.memberships.map((m) => ({
          partnerId: m.partnerId,
          name: m.partner.name,
        }))}
      />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
