"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getPartnerContext } from "@/lib/partner/context";
import { normalizeShopDomain, ShopifyFeedError } from "@/lib/partner-feeds/shopify";
import { syncPartnerShopifyFeed, type SyncResult } from "@/lib/partner-feeds/sync";

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * `partners` has no UPDATE policy for any client role, so these go through the
 * service role — but only ever against the caller's *active* membership, which
 * getPartnerContext has already validated. A client-sent partner id is never
 * trusted.
 */
export async function saveShopifyDomain(
  rawDomain: string
): Promise<ActionResult<{ domain: string | null }>> {
  const ctx = await getPartnerContext();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  const trimmed = (rawDomain ?? "").trim();

  // Empty input disconnects the store.
  if (!trimmed) {
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ shopify_domain: null, feed_enabled: false })
      .eq("id", ctx.active.partnerId);
    if (error) return { ok: false, error: "Nepavyko išsaugoti." };
    revalidatePath("/partner/store");
    return { ok: true, domain: null };
  }

  let domain: string;
  try {
    domain = normalizeShopDomain(trimmed);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ShopifyFeedError ? err.message : "Netinkamas adresas.",
    };
  }

  const { error } = await supabaseAdmin
    .from("partners")
    .update({ shopify_domain: domain, feed_enabled: true })
    .eq("id", ctx.active.partnerId);

  if (error) return { ok: false, error: "Nepavyko išsaugoti." };

  revalidatePath("/partner/store");
  return { ok: true, domain };
}

/** Run the import immediately. Same code path the daily job uses. */
export async function syncNow(): Promise<ActionResult<{ result: SyncResult }>> {
  const ctx = await getPartnerContext();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  try {
    const result = await syncPartnerShopifyFeed(
      supabaseAdmin,
      ctx.active.partnerId
    );
    revalidatePath("/partner/store");
    revalidatePath("/partner/products");
    revalidatePath("/partner");
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Nepavyko atnaujinti produktų.",
    };
  }
}
