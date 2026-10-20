// Server only (service role): imported from /admin/placements pages, which
// call requireAdmin() before anything here runs.
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { ProductHit } from "@/app/admin/editorial/actions";

export type PlacementRow = {
  id: string;
  advertiser: string;
  headline: string;
  body: string | null;
  image_url: string;
  cta_label: string;
  cta_url: string;
  product_ids: string[];
  recipients: string[];
  categories: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
};

export type PlacementStatus = "inactive" | "scheduled" | "live" | "ended";

export function placementStatus(p: Pick<PlacementRow, "is_active" | "starts_at" | "ends_at">, now = new Date()): PlacementStatus {
  if (!p.is_active) return "inactive";
  if (p.starts_at && new Date(p.starts_at) > now) return "scheduled";
  if (p.ends_at && new Date(p.ends_at) <= now) return "ended";
  return "live";
}

const COLUMNS =
  "id, advertiser, headline, body, image_url, cta_label, cta_url, product_ids, recipients, categories, starts_at, ends_at, is_active, priority, created_at";

export async function loadPlacements(): Promise<(PlacementRow & { views: number; clicks: number })[]> {
  const [{ data: rows }, { data: stats }] = await Promise.all([
    supabaseAdmin.from("discover_placements").select(COLUMNS).order("created_at", { ascending: false }),
    supabaseAdmin.from("discover_ad_stats").select("placement_id, views, clicks"),
  ]);
  const totals = new Map<string, { views: number; clicks: number }>();
  for (const s of (stats ?? []) as { placement_id: string; views: number; clicks: number }[]) {
    const t = totals.get(s.placement_id) ?? { views: 0, clicks: 0 };
    t.views += Number(s.views);
    t.clicks += Number(s.clicks);
    totals.set(s.placement_id, t);
  }
  return ((rows ?? []) as PlacementRow[]).map((r) => ({ ...r, ...(totals.get(r.id) ?? { views: 0, clicks: 0 }) }));
}

export async function loadPlacement(id: string): Promise<{ row: PlacementRow; products: ProductHit[] } | null> {
  const { data } = await supabaseAdmin.from("discover_placements").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as PlacementRow;
  let products: ProductHit[] = [];
  if (row.product_ids.length) {
    const { data: p } = await supabaseAdmin
      .from("inspo_products")
      .select("id, product_name, brand_name, merchant_name, price, image_url, in_stock")
      .in("id", row.product_ids);
    const byId = new Map(((p ?? []) as ProductHit[]).map((x) => [x.id, x]));
    products = row.product_ids.map((pid) => byId.get(pid)).filter((x): x is ProductHit => !!x);
  }
  return { row, products };
}
