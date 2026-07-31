import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { InspoProduct, InspoSort } from "@/types/inspo";

/** A curated collection = a small preset query over the feed. */
export type CollectionQuery = {
  productType?: string;
  priceMax?: number;
  onSale?: boolean;
  /** Exact gender match, e.g. "unisex" for the "works for anyone" strip. */
  gender?: "unisex";
  sort?: InspoSort;
  limit?: number;
};

const PRICE_FLOOR = 10;

/** Northern-hemisphere off-season to hide (mirrors useInspoProducts). */
function offSeasonToHide(month: number): "winter" | "summer" | null {
  if (month === 11 || month === 0 || month === 1) return "summer";
  if (month >= 5 && month <= 7) return "winter";
  return null;
}

/**
 * A short, quality-gated slice of the feed for a themed collection strip.
 * Cheap (limit ~12, index-backed) and cached ~10 min.
 */
export function useInspoCollection(key: string, q: CollectionQuery) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["inspo-collection", key, q],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<InspoProduct[]> => {
      let query = supabase
        .from("inspo_products")
        .select("*")
        .eq("in_stock", true)
        .not("image_url", "is", null)
        .not("deep_link", "is", null)
        .gte("price", PRICE_FLOOR);

      switch (q.sort) {
        case "price_asc":
          query = query.order("price", { ascending: true }).order("id");
          break;
        case "discount":
          query = query
            .gt("discount_pct", 0)
            .lte("discount_pct", 85)
            .order("discount_pct", { ascending: false })
            .order("id");
          break;
        default:
          query = query.order("sort_key", { ascending: true }).order("id");
      }

      query = query.limit(q.limit ?? 12);

      if (q.productType) query = query.eq("product_type", q.productType);
      if (q.priceMax != null) query = query.lte("price", q.priceMax);
      if (q.onSale) query = query.gt("discount_pct", 0);
      if (q.gender) query = query.eq("gender", q.gender);

      const hide = offSeasonToHide(new Date().getMonth());
      if (hide) query = query.or(`season.neq.${hide},season.is.null`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as InspoProduct[];
    },
  });
}
