/**
 * Feed importer core: fetch → gunzip → parse → upsert → sweep stale rows.
 *
 * Network-agnostic. Takes a Supabase service-role client (injected so this file
 * stays free of Next path aliases and runs under plain `tsx`) and a FeedAdapter.
 */
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedAdapter, FeedNetwork, NormalizedProduct } from "./types";

const UPSERT_CHUNK = 1000;

export type ImportResult = {
  network: FeedNetwork;
  feedsProcessed: number;
  upserted: number;
  markedOutOfStock: number;
};

/** Shape written to public.inspo_products. */
function toRow(p: NormalizedProduct, syncedAt: string) {
  return {
    id: p.id,
    network: p.network,
    product_name: p.productName,
    image_url: p.imageUrl,
    deep_link: p.deepLink,
    price: p.price,
    rrp: p.rrp,
    currency: p.currency,
    brand_name: p.brandName,
    category_name: p.categoryName,
    merchant_name: p.merchantName,
    merchant_id: p.merchantId,
    in_stock: p.inStock,
    gender: p.gender,
    season: p.season,
    product_type: p.productType,
    synced_at: syncedAt,
    // sort_key intentionally omitted: DB default random() on insert, preserved
    // on update so the discover shuffle stays stable across imports.
  };
}

async function downloadFeed(url: string): Promise<Readable> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`feed download failed: ${res.status} ${res.statusText}`);
  }
  const node = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  // AWIN Create-a-Feed with compression/gzip serves a gzip stream.
  return node.pipe(createGunzip());
}

export async function runImport(
  supabase: SupabaseClient,
  adapter: FeedAdapter,
  log: (msg: string) => void = console.log
): Promise<ImportResult> {
  const runStartedAt = new Date().toISOString();
  const feeds = adapter.listFeeds();
  const seenMerchantIds = new Set<string>();
  let upserted = 0;

  let batch: ReturnType<typeof toRow>[] = [];

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabase
      .from("inspo_products")
      .upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
    upserted += batch.length;
    batch = [];
  };

  for (const feed of feeds) {
    log(`↓ ${feed.label}`);
    const body = await downloadFeed(feed.url);
    for await (const product of adapter.parse(body)) {
      if (product.merchantId) seenMerchantIds.add(product.merchantId);
      batch.push(toRow(product, runStartedAt));
      if (batch.length >= UPSERT_CHUNK) await flush();
    }
    await flush();
    log(`  upserted so far: ${upserted}`);
  }

  // Stale sweep: any previously-imported row for a merchant we saw this run that
  // was NOT touched this run (older synced_at) is gone from the feed → mark out
  // of stock. Scoped to seen merchants so a skipped/failed feed never hides a
  // whole merchant's catalogue. Runs only after every feed parsed cleanly.
  let markedOutOfStock = 0;
  if (seenMerchantIds.size) {
    // count-only (no representation) — avoids pulling back every swept id.
    const { count, error } = await supabase
      .from("inspo_products")
      .update({ in_stock: false }, { count: "exact" })
      .eq("network", adapter.network)
      .in("merchant_id", [...seenMerchantIds])
      .lt("synced_at", runStartedAt)
      .eq("in_stock", true);
    if (error) throw new Error(`stale sweep failed: ${error.message}`);
    markedOutOfStock = count ?? 0;
  }

  return {
    network: adapter.network,
    feedsProcessed: feeds.length,
    upserted,
    markedOutOfStock,
  };
}
