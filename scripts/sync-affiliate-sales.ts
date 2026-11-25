/**
 * Nightly: pull affiliate sales (Awin, CJ) into affiliate_transactions.
 *
 *   node --env-file=.env.local --import tsx scripts/sync-affiliate-sales.ts [days]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, AWIN_API_KEY,
 * AWIN_PUBLISHER_ID, CJ_ACCESS_TOKEN, CJ_COMPANY_ID. Exits non-zero when any
 * network failed, so the GitHub Action shows red instead of silently skipping.
 */
import { createClient } from "@supabase/supabase-js";
import { syncAffiliateSales } from "../lib/affiliateSales/sync";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY not set");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const days = Number(process.argv[2]) || undefined;
  const results = await syncAffiliateSales(supabase, days);
  if (results.some((r) => r.error)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
