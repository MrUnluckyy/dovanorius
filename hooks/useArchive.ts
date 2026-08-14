"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

/**
 * The archive lives on the dashboard, not on a board: a received wish is
 * something you look back on across all your lists, and burying it behind a tab
 * on one board made it hard to find.
 *
 * Filters, columns and the membership join are a straight copy of
 * ../noriuto-app/hooks/use-archived-wishes.ts, whose archive is global too.
 * Both apps share one database, so the two clients must agree on what
 * "archived" and "undo" mean. Fix bugs in the mobile app first, then port here.
 *
 * One deliberate divergence: mobile's undoPurchased writes `purchased_at: null`
 * from the client, this does not. set_items_purchased_at and
 * clear_archived_on_unpurchase already clear both columns on the way out of
 * 'purchased', so writing them client-side is redundant and races the trigger.
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
  /** Which list it came from — only meaningful now that boards are mixed. */
  board_name: string | null;
};

const ARCHIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Root key, so one restore can refresh every archive query at once. */
export const ARCHIVE_KEY = ["archivedItems"];
export const myArchiveKey = (userId: string) => [...ARCHIVE_KEY, "mine", userId];

/** Shape PostgREST returns for the membership join, before it is stripped. */
type ArchiveRow = Omit<ArchivedItem, "board_name"> & {
  boards: { id: string; name: string | null } | null;
};

/**
 * Every purchased wish across the boards the signed-in user belongs to, newest
 * first.
 *
 * Scoping is the whole game here. The SELECT policy on items is
 * `is_member(board_id) OR (board is public)`, so a query that only filters on
 * status would sweep in purchased items from every public board on the
 * platform — other people's gifts, in your archive. The per-board version was
 * safe only because it always pinned board_id.
 *
 * The narrowing is the mobile app's: an inner join through board_members,
 * filtered to this user, which keeps it to one round-trip. board_members is
 * keyed on (board_id, user_id), so the join cannot duplicate an item. `name`
 * rides along on a join that has to happen anyway.
 *
 * reserved_by is never selected, which is how "who gave it" stays off the
 * recipient's screen — same as the mobile app, so no masking layer is needed.
 */
export function useMyArchive(userId: string, enabled = true) {
  const supabase = createClient();

  return useQuery({
    queryKey: myArchiveKey(userId),
    enabled,
    queryFn: async (): Promise<ArchivedItem[]> => {
      const cutoff = new Date(Date.now() - ARCHIVE_WINDOW_MS).toISOString();

      const { data, error } = await supabase
        .from("items")
        .select(
          `id, board_id, title, image_url, image_urls, purchased_at,
           boards!inner ( id, name, board_members!inner ( user_id ) )`
        )
        .eq("status", "purchased")
        .gte("purchased_at", cutoff)
        // items.archived_at is the server-side end of the same 14-day window
        .is("archived_at", null)
        // only boards where *I* am a member
        .eq("boards.board_members.user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;

      // strip nested join payload
      return ((data ?? []) as unknown as ArchiveRow[]).map(
        ({ boards, ...item }) => ({ ...item, board_name: boards?.name ?? null })
      );
    },
  });
}

/**
 * Puts a purchased wish back on the list. Shared by the archive's restore
 * button and the undo action on the "marked as received" toast.
 *
 * `boardId` is known on the board (where undo fires) but not worth threading
 * through the dashboard list, so omitting it refreshes every board's items.
 */
export function useRevertPurchase(boardId?: string) {
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
      queryClient.invalidateQueries({
        queryKey: boardId ? ["items", boardId] : ["items"],
      });
      queryClient.invalidateQueries({ queryKey: ARCHIVE_KEY });
    },
    onError: (error) => {
      toast.error(t("errorRestore"));
      console.error("Error reverting purchase:", error);
    },
  });
}
