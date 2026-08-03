/**
 * Feed importer core: fetch → gunzip → parse → stage → server-side merge.
 *
 * Network-agnostic. Takes a Supabase service-role client (injected so this file
 * stays free of Next path aliases and runs under plain `tsx`) and a FeedAdapter.
 *
 * Delta strategy: a full feed is ~all-unchanged night to night, and re-writing
 * 600k rows into a heavily-indexed table (GIN trigram on product_name) every
 * run is the bottleneck. So we bulk-load the whole feed into an unindexed
 * staging table (plain heap inserts — cheap), then a single server-side
 * `merge_feed_staging` RPC diffs staging against the live table and writes only
 * the rows that actually changed, plus marks disappeared rows out of stock. No
 * 600k-row read back to the client, no per-row upsert.
 */
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedAdapter, FeedNetwork, NormalizedProduct } from "./types";

const STAGE_CHUNK = 1000; // rows per staging insert request

export type ImportResult = {
  network: FeedNetwork;
  feedsProcessed: number;
  staged: number;
  changed: number;
  skippedUnchanged: number;
  markedOutOfStock: number;
};

/** Row shape for public.inspo_products_staging (content columns only). */
function stagingRow(p: NormalizedProduct) {
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
  };
}

/**
 * Retry a Supabase call that can fail transiently. Covers both thrown network
 * errors (`fetch failed`) and returned `{ error }` payloads. Exponential
 * backoff; re-throws after `attempts` tries. A full import makes hundreds of
 * sequential requests, so any single blip must not abort the whole run.
 */
async function withRetry<T>(
  label: string,
  fn: () => PromiseLike<{ data: T; error: { message: string } | null }>,
  attempts = 5
): Promise<T> {
  let lastErr = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await fn();
      if (!error) return data;
      lastErr = error.message;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** i)); // 0.5s,1s,2s,4s
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastErr}`);
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
  const feeds = adapter.listFeeds();

  // Clear any rows a previous (crashed) run may have left behind.
  await withRetry("reset staging", () => supabase.rpc("reset_feed_staging"));

  let staged = 0;
  let batch: ReturnType<typeof stagingRow>[] = [];

  const flush = async () => {
    if (!batch.length) return;
    const rows = batch;
    batch = [];
    await withRetry("stage insert", () =>
      supabase.from("inspo_products_staging").insert(rows)
    );
    staged += rows.length;
  };

  for (const feed of feeds) {
    log(`↓ ${feed.label}`);
    const body = await downloadFeed(feed.url);
    for await (const product of adapter.parse(body)) {
      batch.push(stagingRow(product));
      if (batch.length >= STAGE_CHUNK) await flush();
    }
    await flush();
    log(`  staged: ${staged}`);
  }

  // Single server-side diff-merge: writes only changed rows, sweeps stale ones.
  log(`merging ${staged} staged rows…`);
  const merged = await withRetry("merge", () =>
    supabase.rpc("merge_feed_staging", { p_network: adapter.network })
  );
  const row = (merged as { changed: number; marked_out_of_stock: number }[])?.[0];
  const changed = row?.changed ?? 0;
  const markedOutOfStock = row?.marked_out_of_stock ?? 0;

  // Free the staging rows now rather than leaving 600k rows parked until the
  // next run's reset.
  await withRetry("reset staging", () => supabase.rpc("reset_feed_staging"));

  return {
    network: adapter.network,
    feedsProcessed: feeds.length,
    staged,
    changed,
    skippedUnchanged: staged - changed,
    markedOutOfStock,
  };
}
