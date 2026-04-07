import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PartnerNav } from "./_components/PartnerNav";
import type { Partner } from "@/types/partner";

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

  // Get partner this user belongs to
  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("role, partner:partners(*)")
    .eq("user_id", user.id)
    .single();

  if (!partnerUser) {
    redirect("/dashboard");
  }

  const partner = partnerUser.partner as unknown as Partner;

  return (
    <div className="min-h-screen bg-base-200">
      <PartnerNav partner={partner} role={partnerUser.role} />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
