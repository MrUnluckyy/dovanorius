import { supabaseAdmin } from "@/utils/supabase/admin";

// Server-only: affiliate_clicks has no read policy, so this goes through the
// service role. Callers must have established who may see which partner —
// admin layout, or getPartnerContext() for the partner panel.

export const TRACKING_DAYS = 30;

export type PartnerTracking = {
  clicks: number;
  orders: number;
  /** Sum of non-cancelled attributed order totals, in EUR. */
  sales: number;
};

/** Clicks, attributed orders and sales over the last TRACKING_DAYS, per partner. */
export async function loadTracking(
  partnerIds: string[]
): Promise<Map<string, PartnerTracking>> {
  const out = new Map<string, PartnerTracking>();
  for (const id of partnerIds) out.set(id, { clicks: 0, orders: 0, sales: 0 });
  if (!partnerIds.length) return out;

  const since = new Date(Date.now() - TRACKING_DAYS * 86_400_000).toISOString();

  const [clickCounts, { data: orders }] = await Promise.all([
    // One head-count per partner: there are a handful of partners and a click
    // table that will grow, so counting beats fetching rows.
    Promise.all(
      partnerIds.map(async (id) => {
        const { count } = await supabaseAdmin
          .from("affiliate_clicks")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", id)
          .gte("created_at", since);
        return [id, count ?? 0] as const;
      })
    ),
    supabaseAdmin
      .from("partner_orders")
      .select("partner_id, total, currency")
      .in("partner_id", partnerIds)
      .is("cancelled_at", null)
      .gte("ordered_at", since),
  ]);

  for (const [id, clicks] of clickCounts) out.get(id)!.clicks = clicks;
  for (const o of orders ?? []) {
    const t = out.get(o.partner_id)!;
    t.orders += 1;
    // Partners sell in EUR; a foreign-currency order is counted, not summed.
    if (o.currency === "EUR") t.sales += Number(o.total);
  }
  return out;
}

export function fmtEur(n: number) {
  return new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" }).format(n);
}
