"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { trackWishCreated } from "@/lib/analytics";

export type AddIdeaInput = {
  boardId: string;
  title: string;
  /** Affiliate deep link — stored as the item's url. */
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  /** Optional note (we pass the AI reason). */
  notes?: string | null;
};

/**
 * Insert an inspo/AI gift idea as an item on a board. Mirrors the insert in
 * AddItemModal (same columns/defaults) so ideas behave like hand-added wishes.
 */
export function useAddIdeaToBoard() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddIdeaInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("items").insert({
        board_id: input.boardId,
        title: input.title,
        url: input.url,
        image_url: input.imageUrl,
        image_urls: input.imageUrl ? [input.imageUrl] : null,
        notes: input.notes ?? null,
        created_by: user.id,
        price: input.price,
        is_reservable: true,
        status: "wanted",
        priority: "medium",
        // Same label the app writes for a saved idea.
        source: "inspo",
      });
      if (error) throw error;
      trackWishCreated({
        source: "inspo",
        boardId: input.boardId,
        hasUrl: !!input.url,
        hasImage: !!input.imageUrl,
        hasPrice: input.price != null,
      });
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["items", input.boardId] });
    },
  });
}
