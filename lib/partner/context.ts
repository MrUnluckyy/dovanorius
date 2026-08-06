import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { Partner } from "@/types/partner";

/**
 * Which partner the caller is currently acting as.
 *
 * The panel used to assume one membership per user and resolved it with
 * `.single()`, which errors outright once someone belongs to two partners —
 * routine now that staff join a partner to set it up before handover. Worse,
 * the mutation path used `.limit(1)` and silently picked an arbitrary partner,
 * so a product could be written to the wrong account.
 */
export const ACTIVE_PARTNER_COOKIE = "noriuto_active_partner";

export type PartnerMembership = {
  partnerId: string;
  role: string;
  partner: Partner;
};

export type PartnerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  memberships: PartnerMembership[];
  /** The partner every query on this request should be scoped to. */
  active: PartnerMembership;
};

/** Returns null when the caller is signed out or belongs to no partner. */
export async function getPartnerContext(): Promise<PartnerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("partner_users")
    .select("partner_id, role, partner:partners(*)")
    .eq("user_id", user.id);

  const memberships: PartnerMembership[] = (data ?? [])
    .filter((row) => row.partner)
    .map((row) => ({
      partnerId: row.partner_id as string,
      role: row.role as string,
      partner: row.partner as unknown as Partner,
    }))
    .sort((a, b) => a.partner.name.localeCompare(b.partner.name, "lt"));

  if (memberships.length === 0) return null;

  const requested = (await cookies()).get(ACTIVE_PARTNER_COOKIE)?.value;

  // The cookie is client-controlled, so it only selects among memberships the
  // caller genuinely has — never grants one. RLS (is_partner_member) remains
  // the hard gate underneath.
  const active =
    memberships.find((m) => m.partnerId === requested) ?? memberships[0];

  return { supabase, userId: user.id, memberships, active };
}
