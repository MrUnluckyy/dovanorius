// Server only: imported from route segments, never from client components.
import { createClient } from "@/utils/supabase/server";
import type { InspoProduct } from "@/types/inspo";
import type { RecipientKey } from "./recipients";

/** A sponsored placement, as the page renders it. */
export type Placement = {
  id: string;
  advertiser: string;
  headline: string;
  body: string | null;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  products: InspoProduct[];
};

type Row = {
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
};

/**
 * The one ad for a discover page, or null.
 *
 * RLS (discover_placements_read) already limits rows to live ones. Matching:
 * a placement with recipients only shows on those recipients' pages; one with
 * categories only on those category pages; empty lists match everything.
 * Highest priority wins, newest breaks ties. At most one per page, on purpose.
 */
export async function placementFor(
  recipient: RecipientKey | null,
  category: string | null
): Promise<Placement | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("discover_placements")
      .select("id, advertiser, headline, body, image_url, cta_label, cta_url, product_ids, recipients, categories")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    const row = ((data ?? []) as Row[]).find(
      (p) =>
        (p.recipients.length === 0 || (recipient != null && p.recipients.includes(recipient))) &&
        (p.categories.length === 0 || (category != null && p.categories.includes(category)))
    );
    if (!row) return null;

    let products: InspoProduct[] = [];
    if (row.product_ids.length) {
      const { data: rows } = await supabase
        .from("inspo_products")
        .select("*, display_name")
        .in("id", row.product_ids)
        .eq("in_stock", true)
        .not("image_url", "is", null);
      // Keep the order the admin chose.
      const byId = new Map(((rows ?? []) as InspoProduct[]).map((p) => [p.id, p]));
      products = row.product_ids.map((id) => byId.get(id)).filter((p): p is InspoProduct => !!p);
    }

    return {
      id: row.id,
      advertiser: row.advertiser,
      headline: row.headline,
      body: row.body,
      imageUrl: row.image_url,
      ctaLabel: row.cta_label,
      ctaUrl: row.cta_url,
      products,
    };
  } catch {
    // An ad must never take a page down with it.
    return null;
  }
}
