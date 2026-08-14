"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getPartnerContext } from "@/lib/partner/context";
import {
  normalizeShopDomain,
  detectPlatform,
  getAdapter,
  FeedError,
  type FeedPlatform,
} from "@/lib/partner-feeds";
import { syncPartnerFeed, type SyncResult } from "@/lib/partner-feeds/sync";

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * `partners` has no UPDATE policy for any client role, so these go through the
 * service role — but only ever against the caller's *active* membership, which
 * getPartnerContext has already validated. A client-sent partner id is never
 * trusted.
 */
export async function saveStoreDomain(
  rawDomain: string
): Promise<ActionResult<{ domain: string | null; platform: FeedPlatform | null; platformLabel: string | null }>> {
  const ctx = await getPartnerContext();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  const trimmed = (rawDomain ?? "").trim();

  // Empty input disconnects the store.
  if (!trimmed) {
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ store_domain: null, feed_enabled: false })
      .eq("id", ctx.active.partnerId);
    if (error) return { ok: false, error: "Nepavyko išsaugoti." };
    revalidatePath("/partner/store");
    return { ok: true, domain: null, platform: null, platformLabel: null };
  }

  let domain: string;
  let platform: FeedPlatform;
  try {
    domain = normalizeShopDomain(trimmed);
    // Asked of the shop rather than of the partner — see detectPlatform.
    platform = await detectPlatform(domain);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof FeedError ? err.message : "Netinkamas adresas.",
    };
  }

  const { error } = await supabaseAdmin
    .from("partners")
    .update({ store_domain: domain, feed_platform: platform, feed_enabled: true })
    .eq("id", ctx.active.partnerId);

  if (error) return { ok: false, error: "Nepavyko išsaugoti." };

  revalidatePath("/partner/store");
  return {
    ok: true,
    domain,
    platform,
    platformLabel: getAdapter(platform).label,
  };
}

/** Run the import immediately. Same code path the daily job uses. */
export async function syncNow(): Promise<ActionResult<{ result: SyncResult }>> {
  const ctx = await getPartnerContext();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  try {
    const result = await syncPartnerFeed(supabaseAdmin, ctx.active.partnerId);
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
