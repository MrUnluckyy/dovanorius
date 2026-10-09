import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { LuTriangleAlert } from "react-icons/lu";
import { trialStatus, TRIAL_MONTHS, TRIAL_WARN_DAYS } from "@/lib/partner/trial";
import {
  PartnersClient,
  type AdminPartnerRow,
  type AdminInvite,
  type AdminContact,
} from "./_components/PartnersClient";

export const dynamic = "force-dynamic";

type PartnerRow = {
  id: string;
  name: string;
  slug: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  store_domain: string | null;
  feed_platform: string | null;
  feed_auto_approve: boolean;
  feed_last_synced_at: string | null;
  feed_last_status: string | null;
  feed_last_error: string | null;
  feed_last_count: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
        "id, name, slug, website_url, is_active, created_at, store_domain, feed_platform, feed_auto_approve, feed_last_synced_at, feed_last_status, feed_last_error, feed_last_count, contact_name, contact_email, contact_phone"
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("partner_users").select("partner_id, user_id, role"),
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

  const contactsByPartner = await loadContacts(users.data ?? []);

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
    contact: {
      name: p.contact_name,
      email: p.contact_email,
      phone: p.contact_phone,
    },
    contacts: contactsByPartner.get(p.id) ?? [],
    trial: (() => {
      const t = trialStatus(p.created_at);
      return { state: t.state, endsAt: t.endsAt.toISOString(), daysLeft: t.daysLeft };
    })(),
    storeDomain: p.store_domain,
    feedPlatform: p.feed_platform,
    feedAutoApprove: p.feed_auto_approve,
    feedLastSyncedAt: p.feed_last_synced_at,
    feedLastStatus: p.feed_last_status,
    feedLastError: p.feed_last_error,
    feedLastCount: p.feed_last_count,
  }));

  // Soonest first: the list is "who do I need to write to this week".
  const dueSoon = rows
    .filter((r) => r.trial.state !== "active")
    .sort((a, b) => a.trial.daysLeft - b.trial.daysLeft);

  return (
    <div className="space-y-6">
      {dueSoon.length > 0 && (
        <div role="alert" className="alert alert-warning items-start text-sm">
          <LuTriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              Bandomasis laikotarpis ({TRIAL_MONTHS} mėn.) baigėsi arba baigiasi per{" "}
              {TRIAL_WARN_DAYS} d. Partneriai neišjungiami — tik įspėjami.
            </p>
            <ul className="mt-1 space-y-0.5">
              {dueSoon.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.name}</span>
                  {" — "}
                  {r.trial.state === "ended" ? "baigėsi" : "baigiasi"}{" "}
                  {new Date(r.trial.endsAt).toLocaleDateString("lt-LT")}
                  {": "}
                  {contactLine(r)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <PartnersClient partners={rows} />

      <div className="alert alert-warning text-sm">
        Portalo partnerių produktai kol kas nerodomi Discover sraute ir nėra
        stebimi — įtraukimo analitika bus prieinama, kai jie bus įtraukti į
        srautą.
      </div>
    </div>
  );
}

/**
 * The people to talk to about a partner: its members minus Noriuto staff.
 * Admins join partners to set them up (the "esate narys" badge), and listing
 * ourselves as the contact would be useless.
 */
async function loadContacts(
  members: { partner_id: string; user_id: string; role: string }[]
): Promise<Map<string, AdminContact[]>> {
  const ids = Array.from(new Set(members.map((m) => m.user_id)));
  const byPartner = new Map<string, AdminContact[]>();
  if (!ids.length) return byPartner;

  const [{ data: profiles }, authUsers] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, is_admin").in("id", ids),
    Promise.all(ids.map((id) => supabaseAdmin.auth.admin.getUserById(id))),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emailById = new Map(
    authUsers.flatMap(({ data }) => (data.user ? [[data.user.id, data.user.email ?? null]] : []))
  );

  for (const m of members) {
    const profile = profileById.get(m.user_id);
    if (profile?.is_admin) continue;
    const email = emailById.get(m.user_id);
    if (!email) continue;
    const list = byPartner.get(m.partner_id) ?? [];
    list.push({ email, name: profile?.display_name ?? null, role: m.role });
    byPartner.set(m.partner_id, list);
  }
  return byPartner;
}

function contactLine(r: AdminPartnerRow): string {
  const saved = [r.contact.name, r.contact.email, r.contact.phone].filter(Boolean);
  const emails = [
    ...(saved.length ? [saved.join(", ")] : []),
    ...r.contacts.map((c) => c.email).filter((e) => e !== r.contact.email),
  ];
  return emails.length ? emails.join("; ") : "nėra kontakto";
}
