/**
 * Pull recent sales from every configured network into affiliate_transactions.
 * Each network runs on its own: one failing (expired token) never stops the
 * others, and the failure is reported, not swallowed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAwinSales } from "./awin";
import { fetchCjSales } from "./cj";
import { fetchTradedoublerSales } from "./tradedoubler";
import type { AffiliateSale } from "./types";

export type SyncResult = { network: string; fetched: number; error?: string };

/** 90 days: Douglas and others approve weeks after the sale; statuses change. */
export const SYNC_DAYS = 90;

export async function syncAffiliateSales(
  supabase: SupabaseClient,
  days = SYNC_DAYS,
  log: (m: string) => void = console.log
): Promise<SyncResult[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);

  // Awin returns only advertiser ids; our merchant table has the names.
  const { data: merchants } = await supabase
    .from("affiliate_merchants")
    .select("network, network_advertiser_id, name");
  const awinNames = new Map(
    (merchants ?? [])
      .filter((m) => m.network === "awin" && m.network_advertiser_id)
      .map((m) => [String(m.network_advertiser_id), m.name as string])
  );

  const jobs: [string, () => Promise<AffiliateSale[]>][] = [
    ["awin", () => fetchAwinSales(from, to, awinNames)],
    ["cj", () => fetchCjSales(from, to)],
    ["tradedoubler", () => fetchTradedoublerSales(from, to)],
  ];

  const results: SyncResult[] = [];
  for (const [network, run] of jobs) {
    try {
      const sales = await run();
      for (let i = 0; i < sales.length; i += 500) {
        const batch = sales.slice(i, i + 500).map((s) => ({ ...s, synced_at: new Date().toISOString() }));
        const { error } = await supabase
          .from("affiliate_transactions")
          .upsert(batch, { onConflict: "network,tx_id" });
        if (error) throw new Error(`upsert: ${error.message}`);
      }
      log(`✓ ${network}: ${sales.length} sales (last ${days} days)`);
      results.push({ network, fetched: sales.length });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log(`✗ ${network}: ${error}`);
      results.push({ network, fetched: 0, error });
    }
  }
  return results;
}
