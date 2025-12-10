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
    queryKey: ["boards"],
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
