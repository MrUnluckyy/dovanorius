import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is this viewer on the RECIPIENT side of a board — its owner, or a
 * collaborator who helps maintain it?
 *
 * The reserve affordance used to be gated on `isPublic`, which the three public
 * routes hard-coded to `true`. That conflates "arrived via a public URL" with
 * "is a gift-giver", and they are not the same thing: open a board you
 * co-own from /users/<someone>/<slug> and you were offered a Reserve button on
 * your own shared wishlist.
 *
 * That matters beyond being odd. get_board_items already masks other people's
 * reservations from recipient-side viewers, so a collaborator sees an
 * already-reserved item as "wanted" — with a Reserve button next to it. Pressing
 * it either collides with someone else's reservation or quietly reveals that the
 * item was spoken for.
 *
 * Ownership and membership are the same test the RPC makes, kept here so every
 * route reaches the same answer.
 */
export async function isRecipientSide(
  supabase: SupabaseClient,
  boardId: string,
  ownerId: string | null | undefined,
  userId: string | null | undefined
): Promise<boolean> {
  // Signed out: always a giver.
  if (!userId) return false;
  if (ownerId && ownerId === userId) return true;

  const { data } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!data;
}
