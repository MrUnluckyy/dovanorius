"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

/**
 * The participants of this event that the signed-in organiser looks after,
 * with their wish list board when they have one. Empty for everyone else:
 * managed_users is readable only by the manager (RLS).
 */
export function useManagedMembers(eventId: string | undefined, userIds: string[]) {
  const sb = createClient();
  const key = [...userIds].sort().join(",");
  return useQuery({
    enabled: !!eventId && userIds.length > 0,
    queryKey: ["ss:managed", eventId ?? "none", key],
    queryFn: async () => {
      const { data: rows, error } = await sb
        .from("managed_users")
        .select("user_id")
        .in("user_id", userIds);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.user_id as string);
      const boards = new Map<string, string | null>(ids.map((id) => [id, null]));
      if (ids.length) {
        const { data: owned } = await sb
          .from("boards")
          .select("id, owner_id, created_at")
          .in("owner_id", ids)
          .order("created_at", { ascending: true });
        for (const b of owned ?? []) {
          if (!boards.get(b.owner_id as string)) boards.set(b.owner_id as string, b.id as string);
        }
      }
      return boards;
    },
  });
}
