/**
 * Fill `audience` and `search_norm` across inspo_products.
 *
 *   pnpm tsx scripts/backfill-discover.ts
 *
 * Both columns are derived by the inspo_products_derive trigger, which only
 * fires on write, so every row added before the 20260908100000 migration still
 * carries NULLs. The RPC touches rows in bounded slices to put them through the
 * trigger; this drives it until the queue drains.
 *
 * The same pass also re-applies classify_by_title, so the LEGO-hat and
 * "Dandelion"-is-a-jigsaw fixes from that migration land here too — a row's
 * product_type and gift_score are recomputed whenever it is touched.
 *
 * Resumable: progress is the absence of NULLs, not a cursor, so an interrupted
 * run continues where it stopped. Safe to re-run; a second run finds nothing.
 *
 * Why batched rather than one UPDATE: inspo_products carries GIN trigram
 * indexes, which makes touching rows expensive enough that even a fraction of
 * the table exceeds the statement timeout.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SECRET_KEY.
 */
import { createClient } from "@supabase/supabase-js";

const BATCH = 2000;

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Batches to retry before giving up, and how long to wait between tries. */
const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const supabase = makeClient();
  const started = Date.now();
  let total = 0;

  for (;;) {
    // A ~30-minute run over 160k rows will meet the occasional dropped
    // connection — the first attempt at this died on a bare "TypeError: fetch
    // failed" at 48k and threw away nothing but its own progress reporting.
    // Retrying in place is right because the RPC is idempotent: it claims its
    // batch by selecting rows that are still NULL, so a call that failed
    // after committing is simply a batch the next call no longer sees.
    let n: number | null = null;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await supabase.rpc("backfill_inspo_discover", {
        p_batch: BATCH,
      });
      if (!error) {
        n = Number(data ?? 0);
        break;
      }
      lastError = error.message;
      if (attempt < MAX_RETRIES) {
        const wait = 2 ** attempt * 1000;
        console.warn(`  retry ${attempt}/${MAX_RETRIES - 1} in ${wait}ms: ${lastError}`);
        await sleep(wait);
      }
    }

    if (n === null) {
      console.error(
        `backfill failed after ${MAX_RETRIES} attempts: ${lastError}\n` +
          "Is backfill_inspo_discover() deployed? It ships with " +
          "supabase/migrations/20260908100000_discover_audience_and_search.sql.\n" +
          `Progress is kept — ${total} rows done this run; re-run to continue.`
      );
      process.exit(1);
    }

    if (!n) break;
    total += n;

    if (total % (BATCH * 10) === 0) {
      const secs = (Date.now() - started) / 1000;
      console.log(`  ${total} rows (${Math.round(total / secs)}/s)`);
    }
  }

  console.log(
    `done: ${total} rows in ${Math.round((Date.now() - started) / 1000)}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
