"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

/**
 * Web port of the mobile app's archive tab. Deliberately a straight copy of
 * ../noriuto-app/hooks/use-archived-wishes.ts + the undoPurchased helper in its
 * app/(tabs)/home/index.tsx: same tables, same filters, same columns, no RPCs
 * of its own. Both apps share one database, so the two clients must agree on
 * what "archived" and "undo" mean. Fix bugs in the mobile app first, then port
 * the fix here.
 */

/** A purchased wish still inside the 14-day archive window. */
export type ArchivedItem = {
  id: string;
  board_id: string;
  title: string;
  image_url: string | null;
  /** Web-only: wish cards prefer image_urls[0] and fall back to image_url. */
  image_urls: string[] | null;
  purchased_at: string | null;
};

const ARCHIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const archiveKey = (boardId: string) => ["archivedItems", boardId];

/**
 * Purchased wishes for one board, newest first. The RLS SELECT policy on items
 * already scopes this to board members, and reserved_by is simply never
 * selected — that is how the mobile app keeps "who gave it" off the recipient's
 * screen, so no masking layer is needed here either.
 */
export function useBoardArchive(boardId: string, enabled = true) {
  const supabase = createClient();

  return useQuery({
    queryKey: archiveKey(boardId),
    enabled,
    queryFn: async (): Promise<ArchivedItem[]> => {
      const cutoff = new Date(Date.now() - ARCHIVE_WINDOW_MS).toISOString();

      const { data, error } = await supabase
        .from("items")
        .select("id, board_id, title, image_url, image_urls, purchased_at")
        .eq("board_id", boardId)
        .eq("status", "purchased")
        .gte("purchased_at", cutoff)
        // items.archived_at is the server-side end of the same 14-day window
        .is("archived_at", null)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ArchivedItem[];
    },
  });
}

/**
 * Puts a purchased wish back on the list. Shared by the archive tab's restore
 * button and the undo action on the "marked as received" toast, so both paths
 * refresh the same two caches.
 */
export function useRevertPurchase(boardId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useTranslations("Boards");

  return useMutation({
    mutationFn: async (itemId: string) => {
      // set_items_purchased_at clears purchased_at on the way out of
      // 'purchased' and clear_archived_on_unpurchase clears archived_at, so the
      // wish leaves the archive without either being written here.
      const { error } = await supabase
        .from("items")
        .update({
          status: "wanted", // back to normal
          reserved_by: null,
          reserved_at: null,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("successRestore"));
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      queryClient.invalidateQueries({ queryKey: archiveKey(boardId) });
    },
    onError: (error) => {
      toast.error(t("errorRestore"));
      console.error("Error reverting purchase:", error);
    },
  });
}
