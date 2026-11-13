import { createClient } from "@/utils/supabase/client";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { InspoFilters, InspoProduct } from "@/types/inspo";
import {
  INSPO_PAGE_SIZE,
  PRICE_FLOOR,
  discoverPageArgs,
  offSeasonToHide,
} from "@/lib/discover/gridQuery";

export { INSPO_PAGE_SIZE };

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
 * The filter arguments search_products and search_fallback share, so the
 * fallback relaxes the words but never the visitor's filters.
 */
export function searchFilterArgs(filters: InspoFilters) {
  return {
    p_product_type: filters.productType,
    p_brand: filters.brand,
    p_merchant: filters.merchant,
    p_price_min: Math.max(PRICE_FLOOR, filters.priceMin ?? 0),
    p_price_max: filters.priceMax,
    p_gender: filters.audience === "him" ? "male" : filters.audience === "her" ? "female" : null,
    p_hide_season: filters.inSeason ? offSeasonToHide(new Date().getMonth()) : null,
    p_on_sale: filters.onSaleOnly,
  };
}

/**
 * Paginated, quality-gated read of the product feed for discover.
 *
 * Browsing reads discover_page() (T9): a slim, pre-filtered copy of the feed
 * with keyset pagination, so page 20 costs what page 1 costs and the nightly
 * import no longer evicts it from cache. Search keeps search_products(), which
 * ranks by relevance and pages by offset.
 */
export function useInspoProducts(
  filters: InspoFilters,
  options: {
    enabled?: boolean;
    /** First page rendered on the server for exactly these filters. */
    initialPage?: InspoProduct[];
  } = {}
) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: ["inspo", filters],
    enabled: options.enabled ?? true,
    ...(options.initialPage
      ? {
          initialData: {
            pages: [options.initialPage],
            pageParams: [{ cursor: null, page: 0 } as PageParam],
          },
          // Rendered on the server moments ago: don't fetch it again on hydration.
          staleTime: 5 * 60_000,
        }
      : {}),
    initialPageParam: { cursor: null, page: 0 } as PageParam,
    // Keep the current grid on screen while the next query runs. Without this
    // every keystroke that settled blanked the results into skeletons, which
    // read as "search is slow" even when the query took 50ms.
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      // Search goes through search_products (shared with noriuto-app): it folds
      // diacritics, matches each word, and ranks by relevance.
      const term = filters.search.trim();
      if (term) {
        const { data, error } = await supabase
          .rpc("search_products", {
            p_q: term,
            ...searchFilterArgs(filters),
            p_sort: filters.sort,
            p_limit: INSPO_PAGE_SIZE,
            p_offset: pageParam.page * INSPO_PAGE_SIZE,
            p_source: filters.searchSource ?? "web",
          })
          .select("*, display_name");
        if (error) throw error;
        return (data ?? []) as InspoProduct[];
      }

      const { data, error } = await supabase.rpc(
        "discover_page",
        discoverPageArgs(filters, pageParam.cursor)
      );
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
