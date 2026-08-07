import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Audience, InspoProduct } from "@/types/inspo";

/**
 * A shelf = one themed, quality-gated slice of the catalogue.
 *
 * Everything here leans on the columns added by 20260807120000: `giftable`
 * excludes what nobody gives as a present (tyres, furniture, bedding,
 * underwear), and `gift_score` orders by how giftable a row actually is. Before
 * those existed the page ordered by `sort_key`, whose default is `random()` —
 * which is why discover read as a product dump.
 *
 * `sort_key` survives only as the tiebreaker: scores collide heavily by design,
 * so this keeps equal-quality items rotating rather than freezing one order.
 */
export type ShelfQuery = {
  productType?: string;
  /** Several types in one shelf, e.g. bags + accessories. */
  productTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  onSale?: boolean;
  /** Minimum gift_score. Raise it for hero shelves that must not miss. */
  minScore?: number;
  limit?: number;
};

const PRICE_FLOOR = 10;

function offSeasonToHide(month: number): "winter" | "summer" | null {
  if (month === 11 || month === 0 || month === 1) return "summer";
  if (month >= 5 && month <= 7) return "winter";
  return null;
}

/** Shared gating so shelves, browse and "see all" can never disagree. */
export function applyGiftGates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  audience: Audience,
  opts: { inSeason?: boolean } = {}
) {
  let q = query
    .eq("in_stock", true)
    .eq("giftable", true)
    .not("image_url", "is", null)
    .not("deep_link", "is", null);

  // Audience stays lenient — drop only the KNOWN opposite gender, keep unisex
  // and unknown. Roughly half the catalogue has no gender, and excluding it
  // would empty most shelves.
  if (audience === "him") q = q.or("gender.neq.female,gender.is.null");
  else if (audience === "her") q = q.or("gender.neq.male,gender.is.null");

  if (opts.inSeason) {
    const hide = offSeasonToHide(new Date().getMonth());
    if (hide) q = q.or(`season.neq.${hide},season.is.null`);
  }
  return q;
}

export function useInspoShelf(key: string, q: ShelfQuery, audience: Audience) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["inspo-shelf", key, q, audience],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<InspoProduct[]> => {
      let query = applyGiftGates(
        supabase.from("inspo_products").select("*"),
        audience,
        { inSeason: true }
      ).gte("price", Math.max(PRICE_FLOOR, q.priceMin ?? 0));

      if (q.productType) query = query.eq("product_type", q.productType);
      if (q.productTypes?.length)
        query = query.in("product_type", q.productTypes);
      if (q.priceMax != null) query = query.lte("price", q.priceMax);
      if (q.onSale) query = query.gt("discount_pct", 0).lte("discount_pct", 85);
      if (q.minScore != null) query = query.gte("gift_score", q.minScore);

      const { data, error } = await query
        .order("gift_score", { ascending: false })
        .order("sort_key", { ascending: true })
        .order("id")
        .limit(q.limit ?? 12);

      if (error) throw error;
      return (data ?? []) as InspoProduct[];
    },
  });
}
