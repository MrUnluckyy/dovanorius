/**
 * Re-derive product_type / giftable / gift_score after a rule change.
 *
 *   pnpm tsx scripts/rederive.ts                       # every row
 *   pnpm tsx scripts/rederive.ts "product_type = 'tech'"
 *
 * Walks the primary key in ranges. Earlier versions cleared gift_score as a
 * "needs work" marker and swept for it, but finding those rows meant a
 * sequential scan of 326k rows per batch and every attempt died in the gateway.
 * A keyset walk makes each batch an index range read.
 */
import { createClient } from "@supabase/supabase-js";

const BATCH = 2000;

async function main() {
  const where = process.argv[2] ?? "true";
  // Resume point. These runs take 25 minutes and the connection drops often
  // enough that restarting from zero is the difference between finishing and
  // not — a mid-run failure otherwise leaves the table half re-derived, which is
  // worse than either end state.
  const resumeFrom = process.argv[3] ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env not set");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = Date.now();
  let after = resumeFrom;
  if (resumeFrom) console.log(`resuming after id ${resumeFrom}`);
  let scanned = 0;
  let touched = 0;

  for (;;) {
    let data: unknown = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await supabase.rpc("rederive_inspo_range", {
        p_where: where,
        p_after: after,
        p_batch: BATCH,
      });
      if (!res.error) { data = res.data; lastErr = ""; break; }
      lastErr = res.error.message;
      // Transient drops are common on runs this long; back off and retry the
      // same window rather than abandoning 150k rows of progress.
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
    if (lastErr) {
      console.error(`failed after retries at id ${after}: ${lastErr}`);
      console.error(`resume with: pnpm tsx scripts/rederive.ts "${where}" "${after}"`);
      process.exit(1);
    }
    const r = (data as { last_id: string | null; scanned: number; touched: number }[])?.[0];
    if (!r || !r.scanned || r.last_id == null) break;

    scanned += r.scanned;
    touched += r.touched;
    after = r.last_id;
    if (scanned % 50_000 < BATCH) {
      // Include the id: it is the resume point if the connection drops.
      console.log(`  scanned ${scanned}, re-derived ${touched} · at ${after}`);
    }
  }

  console.log(
    `done: scanned ${scanned}, re-derived ${touched} in ${Math.round((Date.now() - started) / 1000)}s`
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
