"use server";

import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Partner } from "@/types/partner";

// Same shape the partner-side actions use: server-action exceptions are
// redacted to an opaque digest in production, which would swallow the
// Lithuanian messages we want to show.
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** For actions that return nothing on success. */
export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Re-check the admin flag inside every action (the layout guard is UI-only). */
async function requireAdminId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Forbidden");

  return user.id;
}

/** "Red Tuxedo Ceramics" -> "red-tuxedo-ceramics" */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export type CreatePartnerInput = {
  name: string;
  slug?: string;
  websiteUrl?: string;
};

/**
 * Create a partner. `partners` has no INSERT policy for any client role by
 * design, so this goes through the service role — partner accounts are always
 * staff-created, never self-serve.
 */
export async function createPartner(
  input: CreatePartnerInput
): Promise<ActionResult<{ partner: Partner }>> {
  await requireAdminId();

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Pavadinimas per trumpas." };

  const slug = slugify(input.slug?.trim() || name);
  if (!slug) return { ok: false, error: "Nepavyko sugeneruoti nuorodos (slug)." };

  const { data: existing } = await supabaseAdmin
    .from("partners")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: false, error: `Nuoroda „${slug}" jau naudojama.` };

  const { data, error } = await supabaseAdmin
    .from("partners")
    .insert({
      name,
      slug,
      website_url: input.websiteUrl ? normaliseUrl(input.websiteUrl) : null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: "Nepavyko sukurti partnerio." };

  revalidatePath("/admin/partners");
  return { ok: true, partner: data as Partner };
}

/**
 * Add the calling admin to a partner so they can set the account up through the
 * ordinary partner panel (feed, categories, first products) before handover.
 * Granted as 'owner' so nothing in the panel is off-limits while seeding.
 */
export async function joinPartnerAsStaff(
  partnerId: string
): Promise<SimpleResult> {
  const adminId = await requireAdminId();

  const { error } = await supabaseAdmin
    .from("partner_users")
    .upsert(
      { partner_id: partnerId, user_id: adminId, role: "owner" },
      { onConflict: "partner_id,user_id" }
    );

  if (error) return { ok: false, error: "Nepavyko prisijungti prie partnerio." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * Drop the calling admin's own membership — the handover step. Refuses to
 * remove the last member, which would leave the partner unreachable (there is
 * no self-serve way back in).
 */
export async function leavePartnerAsStaff(
  partnerId: string
): Promise<SimpleResult> {
  const adminId = await requireAdminId();

  const { count } = await supabaseAdmin
    .from("partner_users")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error:
        "Negalima palikti paskutinio nario — pirma pakvieskite partnerio savininką.",
    };
  }

  const { error } = await supabaseAdmin
    .from("partner_users")
    .delete()
    .eq("partner_id", partnerId)
    .eq("user_id", adminId);

  if (error) return { ok: false, error: "Nepavyko atsijungti." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * Issue an invite for the merchant. Admin-scoped so it works for partners the
 * caller is not a member of (the partner-side team page is gated on
 * is_partner_member). Role is chosen here — this is how 'owner' is granted.
 */
export async function invitePartnerUser(
  partnerId: string,
  email: string,
  role: "owner" | "member" = "owner"
): Promise<ActionResult<{ token: string }>> {
  await requireAdminId();

  const cleaned = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return { ok: false, error: "Neteisingas el. pašto adresas." };
  }

  // The invite is claimable only by this address (accept_partner_invite checks
  // it), so a stale invite to the wrong address is dead weight — replace it.
  await supabaseAdmin
    .from("partner_invites")
    .delete()
    .eq("partner_id", partnerId)
    .eq("email", cleaned)
    .is("accepted_at", null);

  const { data, error } = await supabaseAdmin
    .from("partner_invites")
    .insert({ partner_id: partnerId, email: cleaned, role })
    .select("token")
    .single();

  if (error) return { ok: false, error: "Nepavyko sukurti kvietimo." };

  revalidatePath("/admin/partners");
  return { ok: true, token: data.token as string };
}

export async function revokePartnerInvite(
  inviteId: string
): Promise<SimpleResult> {
  await requireAdminId();

  const { error } = await supabaseAdmin
    .from("partner_invites")
    .delete()
    .eq("id", inviteId)
    .is("accepted_at", null);

  if (error) return { ok: false, error: "Nepavyko atšaukti kvietimo." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * Trust the merchant's whole catalogue instead of moderating it per product.
 * With a feed of hundreds of items, per-product review is not workable — the
 * queue stays meaningful for manually-added products and untrusted feeds.
 * Only affects products imported after the flip; existing rows keep their
 * status (the sync never rewrites it).
 */
export async function setPartnerFeedAutoApprove(
  partnerId: string,
  autoApprove: boolean
): Promise<SimpleResult> {
  await requireAdminId();

  const { error } = await supabaseAdmin
    .from("partners")
    .update({ feed_auto_approve: autoApprove })
    .eq("id", partnerId);

  if (error) return { ok: false, error: "Nepavyko pakeisti nustatymo." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

export async function setPartnerActive(
  partnerId: string,
  isActive: boolean
): Promise<SimpleResult> {
  await requireAdminId();

  const { error } = await supabaseAdmin
    .from("partners")
    .update({ is_active: isActive })
    .eq("id", partnerId);

  if (error) return { ok: false, error: "Nepavyko pakeisti būsenos." };

  revalidatePath("/admin/partners");
  return { ok: true };
}
