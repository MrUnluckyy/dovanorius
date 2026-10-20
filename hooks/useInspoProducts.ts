import { createClient } from "@/utils/supabase/client";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
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

/** The keyset cursor for the row after `last`, per sort (see discover_page). */
function nextCursor(sort: InspoFilters["sort"], last: InspoProduct & { pos?: number }): string {
  switch (sort) {
    case "price_asc":
    case "price_desc":
      return `${last.price}|${last.id}`;
    case "discount":
      return `${last.discount_pct}|${last.id}`;
    default:
      return String(last.pos);
  }
}

type PageParam = { cursor: string | null; page: number };

/**
 * Paginated, quality-gated read of the product feed for discover.
 *
 * Browsing reads discover_page() (T9): a slim, pre-filtered copy of the feed
 * with keyset pagination, so page 20 costs what page 1 costs and the nightly
 * import no longer evicts it from cache. Search keeps search_products(), which
 * ranks by relevance and pages by offset.
 */
export function useInspoProducts(filters: InspoFilters) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: ["inspo", filters],
    initialPageParam: { cursor: null, page: 0 } as PageParam,
    // Keep the current grid on screen while the next query runs. Without this
    // every keystroke that settled blanked the results into skeletons, which
    // read as "search is slow" even when the query took 50ms.
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      const priceMin = Math.max(PRICE_FLOOR, filters.priceMin ?? 0);
      const hideSeason = filters.inSeason ? offSeasonToHide(new Date().getMonth()) : null;

      // Search goes through search_products (shared with noriuto-app): it folds
      // diacritics, matches each word, and ranks by relevance.
      const term = filters.search.trim();
      if (term) {
        const { data, error } = await supabase
          .rpc("search_products", {
            p_q: term,
            p_product_type: filters.productType,
            p_brand: filters.brand,
            p_merchant: filters.merchant,
            p_price_min: priceMin,
            p_price_max: filters.priceMax,
            p_gender:
              filters.audience === "him" ? "male" : filters.audience === "her" ? "female" : null,
            p_hide_season: hideSeason,
            p_on_sale: filters.onSaleOnly,
            p_sort: filters.sort,
            p_limit: INSPO_PAGE_SIZE,
            p_offset: pageParam.page * INSPO_PAGE_SIZE,
            p_source: "web",
          })
          .select("*, display_name");
        if (error) throw error;
        return (data ?? []) as InspoProduct[];
      }

      const { data, error } = await supabase
        .rpc("discover_page", {
          p_product_type: filters.productType,
          p_product_types: filters.productTypes?.length ? filters.productTypes : null,
          p_audience: filters.audience === "everyone" ? null : filters.audience,
          p_brand: filters.brand,
          p_merchant: filters.merchant,
          p_price_min: priceMin,
          p_price_max: filters.priceMax,
          p_on_sale: filters.onSaleOnly,
          p_hide_season: hideSeason,
          p_sort: filters.sort,
          p_cursor: pageParam.cursor,
          p_limit: INSPO_PAGE_SIZE,
          p_age_group: filters.ageGroup ?? null,
        });
      // discover_page returns display_name as a real column; no computed
      // column lookup (that broke on PostgREST schema reloads).
      if (error) throw error;
      return (data ?? []) as InspoProduct[];
    },
    getNextPageParam: (lastPage, allPages): PageParam | undefined => {
      if (lastPage.length < INSPO_PAGE_SIZE) return undefined;
      return {
        cursor: nextCursor(filters.sort, lastPage[lastPage.length - 1] as InspoProduct & { pos?: number }),
        page: allPages.length,
      };
    },
  });
}
