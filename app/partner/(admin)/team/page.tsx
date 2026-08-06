import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";
import { TeamClient } from "./_components/TeamClient";
import type { PartnerInvite } from "@/types/partner";

type MemberRow = {
  id: string;
  role: string;
  created_at: string;
  user: { id: string; email: string; raw_user_meta_data: Record<string, unknown> };
};

export default async function TeamPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dashboard");

  const { supabase } = ctx;
  const partnerId = ctx.active.partnerId;

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
      currentUserId={ctx.userId}
      currentRole={ctx.active.role}
    />
  );
}
