import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type InspoBrand = { brand: string; n: number };

/**
 * Brands with a meaningful presence in the gift-worthy feed (count >= 50),
 * ordered by size. Powers the searchable brand filter on the discover page.
 * Cached aggressively — the brand set barely moves between nightly syncs.
 */
export function useInspoBrands() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["inspo-brands"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<InspoBrand[]> => {
      const { data, error } = await supabase.rpc("get_inspo_brands");
      if (error) throw error;
      return (data ?? []) as InspoBrand[];
    },
  });
}
