import { createClient } from "@/utils/supabase/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { InspoFilters, InspoProduct } from "@/types/inspo";

export const INSPO_PAGE_SIZE = 24;

// Quality floor: drop the cheap tail (samples/testers) so the feed stays
// "gift-worthy", not a bargain bin. Feed min price is ~€6.
const PRICE_FLOOR = 10;

/** Northern-hemisphere season to hide when "in season" is on. null = shoulder
 * months, hide nothing. */
function offSeasonToHide(month: number): "winter" | "summer" | null {
  if (month === 11 || month === 0 || month === 1) return "summer"; // Dec–Feb
  if (month >= 5 && month <= 7) return "winter"; // Jun–Aug
  return null; // spring / autumn: show everything
}

/**
 * Paginated, quality-gated read of the AWIN product feed for the discover page.
 * Only in-stock products with an image and a real deeplink surface.
 */
export function useInspoProducts(filters: InspoFilters) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: ["inspo", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * INSPO_PAGE_SIZE;
      const to = from + INSPO_PAGE_SIZE - 1;

      let query = supabase
        .from("inspo_products")
        .select("*")
        .eq("in_stock", true)
        // Excludes tyres, furniture, bedding, renovation, cleaning and
        // underwear — the rows that made browse feel like a liquidation sale.
        .eq("giftable", true)
        .not("image_url", "is", null)
        .not("deep_link", "is", null)
        .gte("price", Math.max(PRICE_FLOOR, filters.priceMin ?? 0));

      // Ordering. A stable secondary key (id) keeps pagination deterministic
      // when the primary key ties (e.g. many items at the same price).
      switch (filters.sort) {
        case "price_asc":
          query = query.order("price", { ascending: true }).order("id");
          break;
        case "price_desc":
          query = query.order("price", { ascending: false }).order("id");
          break;
        case "discount":
          // Cap at 85%: legit retail discounts rarely exceed it, and it
          // structurally excludes the known feed-parsing glitches where rrp is
          // 10×/100× the price (→ 90%/99% "off"). No nulls-ordering: the
          // `discount_pct > 0` filter already excludes nulls, and plain DESC
          // lets Postgres use the (discount_pct DESC, id) index over a sort.
          query = query
            .gt("discount_pct", 0)
            .lte("discount_pct", 85)
            .order("discount_pct", { ascending: false })
            .order("id");
          break;
        default:
          // "Recommended" used to be sort_key, whose column default is
          // random() — a uniform draw over 328k rows. gift_score leads now;
          // sort_key survives only to break the (many) ties, so equally good
          // items still rotate between visits.
          query = query
            .order("gift_score", { ascending: false })
            .order("sort_key", { ascending: true })
            .order("id");
      }

      query = query.range(from, to);

      if (filters.merchant) query = query.eq("merchant_name", filters.merchant);
      if (filters.brand) query = query.eq("brand_name", filters.brand);
      if (filters.productType)
        query = query.eq("product_type", filters.productType);
      if (filters.priceMax != null) query = query.lte("price", filters.priceMax);
      if (filters.onSaleOnly) query = query.gt("discount_pct", 0);
      if (filters.search.trim())
        query = query.ilike("product_name", `%${filters.search.trim()}%`);

      // Audience: hide the opposite gender, but keep unisex + unknown (null),
      // so a "For him" user stops seeing dresses/lipstick without losing the
      // large unclassified (genuinely unisex) middle.
      if (filters.audience === "him")
        query = query.or("gender.neq.female,gender.is.null");
      else if (filters.audience === "her")
        query = query.or("gender.neq.male,gender.is.null");

      // Season: hide clearly off-season items; keep 'all' and unknown.
      if (filters.inSeason) {
        const hide = offSeasonToHide(new Date().getMonth());
        if (hide) query = query.or(`season.neq.${hide},season.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as InspoProduct[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === INSPO_PAGE_SIZE ? allPages.length : undefined,
  });
}
