import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

/**
 * The visitor's own top product types from what they opened and saved
 * (discover_my_categories). Empty for visitors without history; callers fall
 * back to the default category order.
 */
export function useMyCategories(enabled: boolean) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["discover-my-categories"],
    enabled,
    staleTime: 1000 * 60 * 10,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("discover_my_categories", {
        p_limit: 8,
      });
      if (error) return [];
      return ((data ?? []) as { product_type: string }[]).map((r) => r.product_type);
    },
  });
}
