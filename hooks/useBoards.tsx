// hooks/useBoards.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export type Board = {
  id: string;
  name: string;
};

export function useBoards() {
  return useQuery({
    // Its own key under "boards": BoardsList caches get_boards_v3 rows (with
    // previews) at ["boards"], and sharing the key handed one the other's
    // shape. Invalidating ["boards"] still refreshes both.
    queryKey: ["boards", "mine-with-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_boards_with_stats")
        .select("*")
        .order("last_item_added_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
