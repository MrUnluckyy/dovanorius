import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import {
  PartnersClient,
  type AdminPartnerRow,
  type AdminInvite,
} from "./_components/PartnersClient";

export const dynamic = "force-dynamic";

type PartnerRow = {
  id: string;
  name: string;
  slug: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  shopify_domain: string | null;
  feed_auto_approve: boolean;
  feed_last_synced_at: string | null;
  feed_last_status: string | null;
  feed_last_error: string | null;
  feed_last_count: number | null;
};

export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [partners, users, products, invites] = await Promise.all([
    supabaseAdmin
      .from("partners")
      .select(
        "id, name, slug, website_url, is_active, created_at, shopify_domain, feed_auto_approve, feed_last_synced_at, feed_last_status, feed_last_error, feed_last_count"
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("partner_users").select("partner_id, user_id"),
    supabaseAdmin.from("partner_products").select("partner_id, is_active"),
    supabaseAdmin
      .from("partner_invites")
      .select("id, partner_id, email, role, token, expires_at")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const partnerRows = (partners.data ?? []) as PartnerRow[];

  const members = new Map<string, number>();
  const staffOf = new Set<string>();
  for (const u of users.data ?? []) {
    members.set(u.partner_id, (members.get(u.partner_id) ?? 0) + 1);
    if (u.user_id === user?.id) staffOf.add(u.partner_id);
  }

  const productCounts = new Map<string, number>();
  for (const p of products.data ?? []) {
    if (p.is_active === false) continue;
    productCounts.set(p.partner_id, (productCounts.get(p.partner_id) ?? 0) + 1);
  }

  const invitesByPartner = new Map<string, AdminInvite[]>();
  for (const i of invites.data ?? []) {
    const list = invitesByPartner.get(i.partner_id) ?? [];
    list.push({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      expires_at: i.expires_at,
    });
    invitesByPartner.set(i.partner_id, list);
  }

  const rows: AdminPartnerRow[] = partnerRows.map((p) => ({
    ...p,
    productCount: productCounts.get(p.id) ?? 0,
    memberCount: members.get(p.id) ?? 0,
    isStaff: staffOf.has(p.id),
    invites: invitesByPartner.get(p.id) ?? [],
    shopifyDomain: p.shopify_domain,
    feedAutoApprove: p.feed_auto_approve,
    feedLastSyncedAt: p.feed_last_synced_at,
    feedLastStatus: p.feed_last_status,
    feedLastError: p.feed_last_error,
    feedLastCount: p.feed_last_count,
  }));

  return (
    <div className="space-y-6">
      <PartnersClient partners={rows} />

      <div className="alert alert-warning text-sm">
        Portalo partnerių produktai kol kas nerodomi Discover sraute ir nėra
        stebimi — įtraukimo analitika bus prieinama, kai jie bus įtraukti į
        srautą.
      </div>
    </div>
  );
}
