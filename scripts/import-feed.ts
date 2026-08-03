/**
 * Product-feed import entry point.
 *
 *   pnpm import:feed            # all configured networks
 *   pnpm import:feed awin       # a single network
 *
 * Run locally with the feed + service-role env vars set, or nightly via the
 * GitHub Action in .github/workflows/import-feed.yml.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
 *   SUPABASE_SECRET_KEY        service-role key (bypasses RLS)
 *   AWIN_DATAFEED_KEY, AWIN_FEED_IDS   (see lib/feeds/awin.ts)
 */
import { createClient } from "@supabase/supabase-js";
import { awinAdapter } from "../lib/feeds/awin";
import { runImport } from "../lib/feeds/importer";
import type { FeedAdapter, FeedNetwork } from "../lib/feeds/types";

const ADAPTERS: Partial<Record<FeedNetwork, FeedAdapter>> = {
  awin: awinAdapter,
  // tradedoubler: tradedoublerAdapter,  // drop-in when the TD adapter lands
};

function makeClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const requested = process.argv.slice(2) as FeedNetwork[];
  const networks = requested.length
    ? requested
    : (Object.keys(ADAPTERS) as FeedNetwork[]);

  const supabase = makeClient();
  let failed = false;

  for (const network of networks) {
    const adapter = ADAPTERS[network];
    if (!adapter) {
      console.error(`✗ unknown network: ${network}`);
      failed = true;
      continue;
    }
    const started = Date.now();
    try {
      const r = await runImport(supabase, adapter, (m) =>
        console.log(`[${network}] ${m}`)
      );
      console.log(
        `✓ ${network}: ${r.upserted} changed, ` +
          `${r.skippedUnchanged} unchanged, ` +
          `${r.markedOutOfStock} marked out-of-stock, ` +
          `${r.feedsProcessed} feed(s) in ${Math.round((Date.now() - started) / 1000)}s`
      );
    } catch (err) {
      failed = true;
      console.error(`✗ ${network} import failed:`, err);
    }
  }

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
