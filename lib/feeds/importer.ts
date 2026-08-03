/**
 * Feed importer core: fetch → gunzip → parse → delta-upsert → sweep stale rows.
 *
 * Network-agnostic. Takes a Supabase service-role client (injected so this file
 * stays free of Next path aliases and runs under plain `tsx`) and a FeedAdapter.
 *
 * Delta strategy: a full feed is ~all-unchanged night to night, and writing
 * 600k rows into a heavily-indexed table (GIN trigram on product_name) is the
 * bottleneck. So we load the current DB state for the network up front, hash
 * each row's content, and only upsert products whose content actually changed
 * (or are new / were previously out of stock). Unchanged rows are never
 * written.
 */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedAdapter, FeedNetwork, NormalizedProduct } from "./types";

const UPSERT_CHUNK = 1000; // rows per write request
const READ_PAGE = 1000; // rows per keyset-paginated read request
const SWEEP_CHUNK = 1000; // ids per out-of-stock update request

// Columns needed to recompute an existing row's content hash. Kept in sync with
// the field list in `contentHash` below. (A stored `content_hash` column would
// let us select just id/hash/in_stock/merchant_id and shrink these reads ~5x —
// a worthwhile future optimization once this settles.)
const HASH_COLUMNS =
  "id, in_stock, merchant_id, product_name, image_url, deep_link, price, rrp, " +
  "currency, brand_name, category_name, merchant_name, gender, season, product_type";

export type ImportResult = {
  network: FeedNetwork;
  feedsProcessed: number;
  upserted: number;
  skippedUnchanged: number;
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

/**
 * Stable fingerprint of the content columns that decide whether a row needs
 * rewriting. Works on both a `toRow` object and a DB row selected via
 * HASH_COLUMNS — both expose the same column names. `id`, `network`, `synced_at`
 * and `sort_key` are deliberately excluded (identity / bookkeeping, not
 * content). Numbers are canonicalized so DB numerics ("10.00") and feed floats
 * (10) don't read as a spurious change.
 */
type HashableRow = {
  in_stock: boolean;
  merchant_id: string | null;
  product_name: string | null;
  image_url: string | null;
  deep_link: string | null;
  price: number | string | null;
  rrp: number | string | null;
  currency: string | null;
  brand_name: string | null;
  category_name: string | null;
  merchant_name: string | null;
  gender: string | null;
  season: string | null;
  product_type: string | null;
};

const num = (v: number | string | null) => (v == null ? "" : Number(v).toString());
const str = (v: string | null) => v ?? "";

function contentHash(r: HashableRow): string {
  const key = [
    str(r.product_name),
    str(r.image_url),
    str(r.deep_link),
    num(r.price),
    num(r.rrp),
    str(r.currency),
    str(r.brand_name),
    str(r.category_name),
    str(r.merchant_name),
    str(r.merchant_id),
    r.in_stock ? "1" : "0",
    str(r.gender),
    str(r.season),
    str(r.product_type),
  ].join("");
  return createHash("sha1").update(key).digest("base64");
}

type ExistingRow = { inStock: boolean; merchantId: string | null; hash: string };

/**
 * Load current DB state for a network into an id → {inStock, merchantId, hash}
 * map. Keyset-paginated on the `id` PK (cheap, and immune to any PostgREST
 * max-rows cap). Content columns are hashed and discarded as we page, so only
 * the compact per-row summary is retained.
 */
async function loadExisting(
  supabase: SupabaseClient,
  network: FeedNetwork
): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  let lastId = "";
  for (;;) {
    const { data, error } = await supabase
      .from("inspo_products")
      .select(HASH_COLUMNS)
      .eq("network", network)
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(READ_PAGE);
    if (error) throw new Error(`load existing failed: ${error.message}`);
    if (!data || data.length === 0) break;
    const rows = data as unknown as (HashableRow & { id: string })[];
    for (const row of rows) {
      map.set(row.id, {
        inStock: row.in_stock,
        merchantId: row.merchant_id,
        hash: contentHash(row),
      });
    }
    lastId = rows[rows.length - 1].id;
    if (data.length < READ_PAGE) break;
  }
  return map;
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

  log(`loading current state for ${adapter.network}…`);
  const existing = await loadExisting(supabase, adapter.network);
  log(`  ${existing.size} existing rows loaded`);

  const seenIds = new Set<string>();
  const seenMerchantIds = new Set<string>();
  let upserted = 0;
  let skippedUnchanged = 0;

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
      const row = toRow(product, runStartedAt);
      seenIds.add(row.id);

      // Skip rows that are already present, in stock, and content-identical.
      const prev = existing.get(row.id);
      if (prev && prev.inStock && prev.hash === contentHash(row)) {
        skippedUnchanged += 1;
        continue;
      }
      batch.push(row);
      if (batch.length >= UPSERT_CHUNK) await flush();
    }
    await flush();
    log(`  changed: ${upserted}, unchanged: ${skippedUnchanged}`);
  }

  // Stale sweep: any row we had in stock, for a merchant we saw this run, that
  // did NOT appear in the feed → it's gone → mark out of stock. Scoped to seen
  // merchants so a skipped/failed feed never hides a whole merchant's
  // catalogue. Runs only after every feed parsed cleanly (a parse error throws
  // above, before we get here).
  const disappeared: string[] = [];
  for (const [id, info] of existing) {
    if (
      info.inStock &&
      info.merchantId &&
      seenMerchantIds.has(info.merchantId) &&
      !seenIds.has(id)
    ) {
      disappeared.push(id);
    }
  }

  let markedOutOfStock = 0;
  for (let i = 0; i < disappeared.length; i += SWEEP_CHUNK) {
    const chunk = disappeared.slice(i, i + SWEEP_CHUNK);
    const { error } = await supabase
      .from("inspo_products")
      .update({ in_stock: false, synced_at: runStartedAt })
      .in("id", chunk);
    if (error) throw new Error(`stale sweep failed: ${error.message}`);
    markedOutOfStock += chunk.length;
  }

  return {
    network: adapter.network,
    feedsProcessed: feeds.length,
    upserted,
    skippedUnchanged,
    markedOutOfStock,
  };
}
