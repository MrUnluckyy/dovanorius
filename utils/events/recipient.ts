import type { SupabaseClient } from "@supabase/supabase-js";

export type Recipient = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** What they said they'd like, for this event only. */
  wants: string | null;
  /** Whether there is actually a wish list behind the "view wish list" link. */
  hasWishlist: boolean;
};

/**
 * Everything a giver needs about the person they drew.
 *
 * The wish note comes from ss_members rather than a board: a guest has no
 * account and therefore no wish list, and a Secret Santa where half the room
 * cannot say what they want is not worth running. `hasWishlist` exists so the
 * link is only offered when there is something behind it — it used to lead to
 * an empty profile page for every guest.
 */
export async function fetchRecipient(
  sb: SupabaseClient,
  eventId: string,
  receiverId: string
): Promise<Recipient | null> {
  const [{ data: profile }, { data: member }, { count }] = await Promise.all([
    sb
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", receiverId)
      .maybeSingle(),
    sb
      .from("ss_members")
      .select("wants")
      .eq("event_id", eventId)
      .eq("user_id", receiverId)
      .maybeSingle(),
    sb
      .from("boards")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", receiverId)
      .eq("is_public", true),
  ]);

  if (!profile) return null;

  return {
    id: profile.id as string,
    display_name: (profile.display_name as string) ?? null,
    avatar_url: (profile.avatar_url as string) ?? null,
    wants: (member?.wants as string) ?? null,
    hasWishlist: (count ?? 0) > 0,
  };
}
