import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type InspoBrand = { brand: string; n: number };

/**
 * Brands with a meaningful presence in the gift-worthy feed (count >= 50),
 * ordered by size. Powers the searchable brand filter on the discover page.
 * Cached aggressively — the brand set barely moves between nightly syncs.
 */
export function useInspoBrands(productType?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["inspo-brands", productType ?? "all"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<InspoBrand[]> => {
      // Scoped to the chosen category when there is one — offering adidas while
      // browsing Grožis is noise. The unscoped list keeps its own threshold and
      // materialised-view backing for the "all categories" case.
      const { data, error } = productType
        ? await supabase.rpc("get_inspo_brands_for_type", {
            p_product_type: productType,
          })
        : await supabase.rpc("get_inspo_brands");
      if (error) throw error;
      return (data ?? []) as InspoBrand[];
    },
  });
}
