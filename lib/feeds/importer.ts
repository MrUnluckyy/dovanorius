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
import type { FeedAdapter, FeedNetwork, FeedSource, NormalizedProduct } from "./types";
import { createCurator, type CurationConfig, type CurationStats } from "./curate";

const STAGE_CHUNK = 1000; // rows per staging insert request
const MERGE_BATCH = 5000; // staging rows merged per server-side statement

export type RunOptions = {
  log?: (msg: string) => void;
  /**
   * Curate the feed before staging (P2). null/undefined stages every parsed row
   * unchanged (legacy behaviour). A config collapses size/colour variants and
   * drops non-giftable rows.
   */
  curate?: CurationConfig | null;
  /**
   * Rebuild mode: after merging, DELETE affiliate rows for the feed's merchants
   * that are no longer in the (curated) staging set, so the served table shrinks
   * to exactly the curated set. When false, disappeared rows are only marked out
   * of stock (the legacy sweep).
   */
  prune?: boolean;
};

export type ImportResult = {
  network: FeedNetwork;
  feedsProcessed: number;
  considered: number;
  kept: number;
  staged: number;
  changed: number;
  skippedUnchanged: number;
  markedOutOfStock: number;
  pruned: number;
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
    // Statement timeouts are deterministic — retrying just burns the timeout
    // again. Fail fast so a too-large statement surfaces immediately.
    if (/statement timeout/i.test(lastErr)) break;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** i)); // 0.5s,1s,2s,4s
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastErr}`);
}

async function downloadFeed(
  feed: FeedSource,
  log: (msg: string) => void
): Promise<Readable> {
  // An adapter may own its download when a plain fetch is not enough (TD's bulk
  // export has to be polled while the file is generated).
  let node: Readable;
  if (feed.download) {
    node = await feed.download(log);
  } else {
    const res = await fetch(feed.url);
    if (!res.ok || !res.body) {
      throw new Error(`feed download failed: ${res.status} ${res.statusText}`);
    }
    node = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  }

  if (feed.compression === "none") return node;

  // AWIN Create-a-Feed with compression/gzip serves a gzip stream. .pipe() does
  // not forward source errors, so forward a mid-download reset onto the gunzip
  // stream — otherwise it lands as an unhandled 'error' event and crashes.
  const gunzip = createGunzip();
  node.on("error", (err) => gunzip.destroy(err));
  return node.pipe(gunzip);
}

export async function runImport(
  supabase: SupabaseClient,
  adapter: FeedAdapter,
  options: RunOptions = {}
): Promise<ImportResult> {
  const { log = console.log, curate = null, prune = false } = options;
  const feeds = adapter.listFeeds();

  // Clear any rows a previous (crashed) run may have left behind.
  await withRetry("reset staging", () => supabase.rpc("reset_feed_staging"));

  let staged = 0;
  let considered = 0;
  let kept = 0;
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

  // Download + parse + (curate) + stage one feed. Retried as a unit: a network
  // reset can interrupt a multi-minute streamed download, and there's no way to
  // resume mid-stream, so we re-pull the whole feed. A fresh curator per attempt
  // keeps variant collapse correct on retry; the merge dedupes staging by id, so
  // re-staging is safe.
  const stageFeed = async (feed: (typeof feeds)[number]): Promise<CurationStats | null> => {
    // Feed-level overrides win over the run's config: within one network the
    // feeds can disagree on which fields they even publish.
    const curator = curate ? createCurator({ ...curate, ...feed.curate }) : null;
    const body = await downloadFeed(feed, log);
    const rows = feed.parse ? feed.parse(body) : adapter.parse(body);
    for await (const product of rows) {
      const row = curator ? curator.consider(product) : product;
      if (!row) continue; // curated out
      batch.push(stagingRow(row));
      if (batch.length >= STAGE_CHUNK) await flush();
    }
    await flush();
    return curator?.stats ?? null;
  };

  for (const feed of feeds) {
    log(`↓ ${feed.label}`);
    let lastErr: unknown;
    let stats: CurationStats | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        batch = []; // drop any partial batch from a failed attempt
        stats = await stageFeed(feed);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        log(`  ${feed.label} attempt ${attempt}/3 failed: ${msg}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (lastErr) throw lastErr;
    if (stats) {
      considered += stats.considered;
      kept += stats.kept;
      log(
        `  curated: kept ${stats.kept}/${stats.considered} ` +
          `(variants ${stats.skipped.duplicate_variant}, price ${stats.skipped.price}, ` +
          `stock ${stats.skipped.stock}, junk ${stats.skipped.junk})`
      );
    }
    log(`  staged: ${staged}`);
  }

  // Server-side diff-merge, driven in id-range batches so each statement stays
  // well under the DB statement timeout. Writes only rows whose content changed.
  log(`merging ${staged} staged rows…`);
  let changed = 0;
  let after = "";
  for (;;) {
    const rows = await withRetry("merge batch", () =>
      supabase.rpc("merge_feed_staging_range", {
        p_network: adapter.network,
        p_after: after,
        p_batch: MERGE_BATCH,
      })
    );
    const r = (rows as { last_id: string | null; processed: number; changed: number }[])?.[0];
    if (!r || r.processed === 0 || r.last_id == null) break;
    changed += r.changed;
    after = r.last_id;
    log(`  merged up to ${after}: ${changed} changed`);
  }

  // Reconcile rows that disappeared from the feed. Both paths are scoped to the
  // merchants present in staging, so a missing/failed feed never wipes a whole
  // merchant's catalogue.
  //   prune  → DELETE them (curated rebuild: table becomes exactly the staged set)
  //   sweep  → mark them out of stock (legacy delta: keep the row, hide it)
  let markedOutOfStock = 0;
  let pruned = 0;
  if (prune) {
    log("pruning rows no longer in the staged set…");
    let after = "";
    for (;;) {
      const rows = await withRetry("prune batch", () =>
        supabase.rpc("prune_feed_staging_range", {
          p_network: adapter.network,
          p_after: after,
          p_batch: MERGE_BATCH,
        })
      );
      const r = (rows as { last_id: string | null; scanned: number; deleted: number }[])?.[0];
      if (!r || r.scanned === 0 || r.last_id == null) break;
      pruned += r.deleted;
      after = r.last_id;
      log(`  pruned up to ${after}: ${pruned} deleted`);
    }
  } else {
    markedOutOfStock =
      (await withRetry("sweep", () =>
        supabase.rpc("sweep_feed_staging", { p_network: adapter.network })
      )) ?? 0;
  }

  // Free the staging rows now rather than leaving them parked until the next
  // run's reset.
  await withRetry("reset staging", () => supabase.rpc("reset_feed_staging"));

  return {
    network: adapter.network,
    feedsProcessed: feeds.length,
    considered,
    kept,
    staged,
    changed,
    skippedUnchanged: staged - changed,
    markedOutOfStock,
    pruned,
  };
}
