import { createClient } from "@/utils/supabase/server";
import { TeamClient } from "./_components/TeamClient";
import type { PartnerInvite } from "@/types/partner";

type MemberRow = {
  id: string;
  role: string;
  created_at: string;
  user: { id: string; email: string; raw_user_meta_data: Record<string, unknown> };
};

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("partner_id, role")
    .eq("user_id", user!.id)
    .single();

  const partnerId = partnerUser!.partner_id;

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("partner_users")
      .select("id, role, created_at, user:users(id, email, raw_user_meta_data)")
      .eq("partner_id", partnerId),
    supabase
      .from("partner_invites")
      .select("*")
      .eq("partner_id", partnerId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <TeamClient
      members={(members ?? []) as unknown as MemberRow[]}
      invites={(invites ?? []) as PartnerInvite[]}
      partnerId={partnerId}
      currentUserId={user!.id}
      currentRole={partnerUser!.role}
    />
  );
}
