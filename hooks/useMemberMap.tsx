"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";

type MemberRow = {
  board_id: string;
  role: "owner" | "editor" | "viewer";
  profiles: { avatar_url: string | null; display_name: string | null }[]; // joined array
};

export function useBoardMembersMap(boardIds: string[]) {
  const supabase = createClient();

  const {
    data = {},
    isLoading,
    error,
  } = useQuery({
    queryKey: ["boardMembers", boardIds.sort().join(",")],
    enabled: boardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_members")
        .select("board_id, role, profiles: user_id (avatar_url, display_name)")
        .in("board_id", boardIds);

      if (error) throw error;

      // Group by board_id, flatten the single joined profile from array
      const map: Record<
        string,
        { avatar: string | null; name: string | null; role: string }[]
      > = {};
      (data as MemberRow[]).forEach((r) => {
        const p = Array.isArray(r.profiles)
          ? r.profiles[0]
          : (r.profiles as any);
        const item = {
          avatar: p?.avatar_url ?? null,
          name: p?.display_name ?? null,
          role: r.role,
        };
        if (!map[r.board_id]) map[r.board_id] = [];
        map[r.board_id].push(item);
      });

      // Optional: put owner first, then editors, then viewers
      Object.values(map).forEach((arr) =>
        arr.sort((a, b) => roleRank(a.role) - roleRank(b.role))
      );

      return map;
    },
  });

  return {
    membersByBoard: data as Record<
      string,
      { avatar: string | null; name: string | null; role: string }[]
    >,
    isLoading,
    error,
  };
}

function roleRank(role: string) {
  if (role === "owner") return 0;
  if (role === "editor") return 1;
  return 2;
}
