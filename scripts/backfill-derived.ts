/**
 * Re-derive product_type / giftable / gift_score across inspo_products.
 *
 *   pnpm tsx scripts/backfill-derived.ts            # fill rows missing a score
 *   pnpm tsx scripts/backfill-derived.ts --all      # re-derive EVERY row
 *   pnpm tsx scripts/backfill-derived.ts --where "product_name ~* 'laikrod'"
 *
 * Run this after changing any of the derivation functions
 * (classify_product_type / is_giftable / compute_gift_score) — existing rows
 * keep their old values until they are touched, because the trigger only fires
 * on write.
 *
 * Why a script and not one UPDATE: inspo_products carries a GIN trigram index on
 * product_name, so touching rows is expensive enough that even an eighth of the
 * table blows the statement timeout. The RPC does bounded slices; this just
 * drives it.
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

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const whereIdx = args.indexOf("--where");
  const where = whereIdx >= 0 ? args[whereIdx + 1] : null;

  const supabase = makeClient();

  // Both re-derivation modes work by clearing gift_score for the rows in scope,
  // which puts them back in the RPC's queue (and in its partial index).
  //
  // The reset is batched for the same reason the backfill is: clearing the
  // column across 326k rows in one statement blows the statement timeout on a
  // table carrying a GIN trigram index, and `--all` then never reached the
  // backfill loop at all.
  if (all || where) {
    const scope = where ?? "true";
    let queued = 0;
    for (;;) {
      const { data, error } = await supabase.rpc("reset_inspo_derived", {
        p_where: scope,
        p_batch: 5000,
      });
      if (error) {
        console.error(
          `Could not reset scope — is reset_inspo_derived() deployed? ${error.message}`
        );
        process.exit(1);
      }
      const n = Number(data ?? 0);
      if (!n) break;
      queued += n;
      if (queued % 50_000 === 0) console.log(`  queued ${queued}…`);
    }
    console.log(`queued for re-derivation: ${queued} rows matching ${scope}`);
  }

  const started = Date.now();
  let total = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("backfill_inspo_derived", {
      p_batch: BATCH,
    });
    if (error) {
      console.error("backfill failed:", error.message);
      process.exit(1);
    }
    const n = Number(data ?? 0);
    if (!n) break;
    total += n;
    if (total % (BATCH * 10) === 0) {
      const rate = Math.round(total / ((Date.now() - started) / 1000));
      console.log(`  ${total} rows (${rate}/s)`);
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
