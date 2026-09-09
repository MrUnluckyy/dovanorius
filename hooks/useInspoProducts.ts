import { createClient } from "@/utils/supabase/client";
import { foldForSearch } from "@/utils/helpers/search";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AgeGroup, InspoFilters, InspoProduct } from "@/types/inspo";

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

      // Age bracket. Always pinned — the shopper is buying for an adult, a teen
      // or a child, never for an unspecified blend of the three, and leaving it
      // open is what used to put 17,900 rows of children's clothing in front of
      // someone shopping for their partner.
      //
      // Adult keeps unclassified rows, the way the gender filter below keeps
      // gender-null ones. `audience` is derived on write, so a NULL means the
      // trigger has not reached that row yet (a backfill still draining, an
      // import that outran it) — and an unclassified product should degrade to
      // "shown to adults", which is the widest bracket and where it most likely
      // belongs, rather than vanishing from every bracket at once. The narrow
      // brackets stay strict: a NULL is not evidence of being for a child.
      //
      // NOTE: `filters.ageGroup` maps to the DB column `audience`, while
      // `filters.audience` below is the her/him GENDER lens and maps to
      // `gender`. Two different axes; the names nearly collide.
      query =
        filters.ageGroup === "adult"
          ? query.or("audience.eq.adult,audience.is.null")
          : query.eq("audience", filters.ageGroup);

      // Search. Each word becomes its own ILIKE against `search_norm`, so terms
      // match in any order and anywhere in the text — "lego duplo" found
      // nothing as a single substring because it required exact adjacency in
      // the title. `search_norm` folds diacritics and appends brand and
      // category, which is what lets "zaislai" reach "žaislai" rows and "nike"
      // reach a row whose title never says Nike. The term has to be folded the
      // same way the column was; foldForSearch is that folding.
      for (const term of foldForSearch(filters.search).split(/\s+/)) {
        if (term) query = query.ilike("search_norm", `%${term}%`);
      }

      // Gender: hide the opposite gender, but keep unisex + unknown (null),
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

/**
 * Which OTHER age brackets this search would have found something in.
 *
 * Pinning an age bracket makes an honest empty state misleading: searching
 * "lego duplo" as an adult returns nothing, because Duplo is a toddler's toy
 * and every match sits one bracket away. All the shopper sees is "no products
 * match", with nothing to suggest the catalogue does in fact have what they
 * asked for — the same dead end as the old broken search, arrived at from the
 * opposite direction.
 *
 * Counts only, and only when the current bracket came back empty, so this is
 * two `head: true` requests on a page that is otherwise showing nothing.
 */
export function useSearchInOtherAges(filters: InspoFilters, enabled: boolean) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["inspo-other-ages", filters],
    enabled: enabled && !!filters.search.trim(),
    queryFn: async (): Promise<{ age: AgeGroup; count: number }[]> => {
      const others = (["adult", "teen", "kid"] as AgeGroup[]).filter(
        (a) => a !== filters.ageGroup
      );

      const results = await Promise.all(
        others.map(async (age) => {
          // Deliberately mirrors the main query's gates, minus ordering and
          // paging — a count that counted rows the grid would not show would
          // send the shopper to another empty page.
          let q = supabase
            .from("inspo_products")
            .select("id", { count: "exact", head: true })
            .eq("in_stock", true)
            .eq("giftable", true)
            .not("image_url", "is", null)
            .not("deep_link", "is", null)
            .gte("price", Math.max(PRICE_FLOOR, filters.priceMin ?? 0));

          q =
            age === "adult"
              ? q.or("audience.eq.adult,audience.is.null")
              : q.eq("audience", age);

          for (const term of foldForSearch(filters.search).split(/\s+/)) {
            if (term) q = q.ilike("search_norm", `%${term}%`);
          }
          if (filters.productType) q = q.eq("product_type", filters.productType);
          if (filters.brand) q = q.eq("brand_name", filters.brand);
          if (filters.priceMax != null) q = q.lte("price", filters.priceMax);
          if (filters.onSaleOnly) q = q.gt("discount_pct", 0);

          const { count, error } = await q;
          if (error) throw error;
          return { age, count: count ?? 0 };
        })
      );

      return results.filter((r) => r.count > 0);
    },
  });
}
