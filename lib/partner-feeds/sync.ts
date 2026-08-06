import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchShopifyCatalog, ShopifyFeedError } from "./shopify";

export type SyncResult = {
  fetched: number;
  written: number;
  /** Sold out upstream and never imported before — see the filter in the map. */
  skippedSoldOut: number;
  deactivated: number;
  currency: string;
  autoApproved: boolean;
};

const CHUNK = 500;

type ExistingRow = {
  external_id: string;
  status: string;
  categories: string[] | null;
};

/**
 * Pull a partner's Shopify catalogue into partner_products.
 *
 * Ownership is split, and that split is the whole reason this is safe to run
 * nightly:
 *   - Shopify owns title, description, price, currency, image, URL, stock.
 *   - The partner owns status, categories, min_age, max_age, gender — the gift
 *     metadata Shopify has no concept of. Those are seeded on first import and
 *     never overwritten afterwards.
 *
 * Status in particular must never be rewritten: the partner_product_projection
 * trigger retracts an inspo_products row the moment status leaves 'approved',
 * so a sync that reset status would yank the catalogue out of Discover nightly.
 *
 * Must run with the service role — RLS pins partner-role writes to
 * status='pending', which would make auto-approve impossible.
 */
export async function syncPartnerShopifyFeed(
  supabase: SupabaseClient,
  partnerId: string
): Promise<SyncResult> {
  const startedAt = new Date().toISOString();

  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("id, shopify_domain, feed_auto_approve")
    .eq("id", partnerId)
    .single();

  if (partnerErr || !partner) {
    throw new ShopifyFeedError("Partneris nerastas.");
  }
  if (!partner.shopify_domain) {
    throw new ShopifyFeedError("Nenurodytas Shopify parduotuvės adresas.");
  }

  try {
    const { currency, products } = await fetchShopifyCatalog(
      partner.shopify_domain
    );

    const { data: existingRows } = await supabase
      .from("partner_products")
      .select("external_id, status, categories")
      .eq("partner_id", partnerId)
      .eq("source", "shopify");

    const existing = new Map<string, ExistingRow>(
      ((existingRows ?? []) as ExistingRow[]).map((r) => [r.external_id, r])
    );

    const defaultStatus = partner.feed_auto_approve ? "approved" : "pending";

    // Never import something that has only ever been unavailable: it can't be
    // bought, so it's noise in the partner's list and can never reach Discover.
    // Stores selling one-off items (handmade, vintage) keep sold-out listings up
    // permanently, so this is most of a catalogue, not an edge case.
    //
    // Products we HAVE seen before are always kept, so a normal retailer's
    // restock is tracked and a sell-out still propagates as is_active = false.
    const importable = products.filter(
      (p) => p.inStock || existing.has(p.externalId)
    );
    const skippedSoldOut = products.length - importable.length;

    const rows = importable.map((p) => {
      const prev = existing.get(p.externalId);
      return {
        partner_id: partnerId,
        external_id: p.externalId,
        source: "shopify",
        title: p.title,
        description: p.description,
        price: p.price,
        currency,
        image_url: p.imageUrl,
        product_url: p.productUrl,
        sku: p.sku,
        is_active: p.inStock,
        last_seen_at: startedAt,
        // Feed back what the partner already has so the upsert can't clobber it.
        status: prev?.status ?? defaultStatus,
        categories: prev?.categories ?? p.categories,
      };
    });

    let written = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("partner_products")
        .upsert(chunk, { onConflict: "partner_id,external_id" });
      if (error) throw new ShopifyFeedError(error.message);
      written += chunk.length;
    }

    // Anything the store no longer lists is deactivated, never deleted — the
    // projection trigger retracts it from Discover on its own.
    const { data: stale } = await supabase
      .from("partner_products")
      .update({ is_active: false })
      .eq("partner_id", partnerId)
      .eq("source", "shopify")
      .eq("is_active", true)
      .lt("last_seen_at", startedAt)
      .select("id");

    const deactivated = stale?.length ?? 0;

    await supabase
      .from("partners")
      .update({
        feed_last_synced_at: new Date().toISOString(),
        feed_last_status: "ok",
        feed_last_error: null,
        feed_last_count: products.length,
      })
      .eq("id", partnerId);

    return {
      fetched: products.length,
      written,
      skippedSoldOut,
      deactivated,
      currency,
      autoApproved: Boolean(partner.feed_auto_approve),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nežinoma klaida.";
    await supabase
      .from("partners")
      .update({
        feed_last_synced_at: new Date().toISOString(),
        feed_last_status: "error",
        feed_last_error: message.slice(0, 500),
      })
      .eq("id", partnerId);
    throw err;
  }
}
