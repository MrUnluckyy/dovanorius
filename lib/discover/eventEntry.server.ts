// Server only: discover route segments read this, never client components.
import { createClient } from "@/utils/supabase/server";
import { firstName } from "./ltName";

/**
 * Discover entered from a Secret Santa reveal (dev-issue-discover-premium 4.6,
 * state 4): /discover?event=<slug>.
 *
 * Only the giver gets this. ss_my_assignment is a view on giver = auth.uid(),
 * so a visitor who is not the giver in that event simply finds no row and
 * falls back to their normal discover. Everything returned here is what the
 * event already shows the giver: the receiver's name, avatar and wish note,
 * and their public wishes. Nothing about the giver's own profile is used, and
 * nothing private about the receiver (date of birth, gender) is read.
 */

export type EventWish = {
  id: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  /** Their public board (/b/<slug>) opened on this wish (?wish=): the existing
   *  reserve flow lives there. /boards/<id> is the owner's page and would send
   *  a giver to their own boards. */
  href: string;
};

export type EventEntry = {
  slug: string;
  name: string;
  budget: number | null;
  eventDate: string | null;
  receiver: {
    firstName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  /** What they asked for in this event (ss_members.wants). */
  wants: string | null;
  /** Their public, still-reservable wishes within the budget. */
  wishes: EventWish[];
};

type BoardItem = {
  id: string;
  board_id: string;
  title: string | null;
  price: number | null;
  status: string | null;
  is_reservable: boolean | null;
  image_url: string | null;
  image_urls: string[] | null;
};

const MAX_BOARDS = 4;
const MAX_WISHES = 8;

export async function loadEventEntry(slug: string): Promise<EventEntry | null> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const { data: event } = await sb
      .from("ss_events")
      .select("id, slug, name, type, budget, event_date")
      .eq("slug", slug)
      .maybeSingle();
    // Only Secret Santa has a gift to find; a name draw has none.
    if (!event || event.type !== "secret_santa") return null;

    const { data: mine } = await sb
      .from("ss_my_assignment")
      .select("receiver")
      .eq("event_id", event.id)
      .maybeSingle();
    if (!mine?.receiver) return null;

    const [{ data: profile }, { data: member }, { data: boards }] = await Promise.all([
      sb.from("profiles").select("display_name, avatar_url").eq("id", mine.receiver).maybeSingle(),
      sb
        .from("ss_members")
        .select("wants")
        .eq("event_id", event.id)
        .eq("user_id", mine.receiver)
        .maybeSingle(),
      sb
        .from("boards")
        .select("id, slug")
        .eq("owner_id", mine.receiver)
        .eq("is_public", true)
        .limit(MAX_BOARDS),
    ]);

    // get_board_items applies reservation privacy and drops archived wishes.
    const lists = await Promise.all(
      (boards ?? []).map((b) =>
        sb.rpc("get_board_items", { p_board_id: b.id }).then((r) => (r.data ?? []) as BoardItem[])
      )
    );
    const slugById = new Map((boards ?? []).map((b) => [b.id as string, b.slug as string]));
    const budget = event.budget as number | null;
    const wishes = lists
      .flat()
      .filter(
        (i) =>
          i.status === "wanted" &&
          i.is_reservable !== false &&
          (budget == null || i.price == null || i.price <= budget) &&
          slugById.has(i.board_id)
      )
      .slice(0, MAX_WISHES)
      .map((i) => ({
        id: i.id,
        title: i.title ?? "",
        price: i.price,
        imageUrl: i.image_urls?.[0] ?? i.image_url ?? null,
        href: `/b/${slugById.get(i.board_id)}?wish=${i.id}`,
      }));

    const displayName = (profile?.display_name as string | null) ?? null;
    return {
      slug: event.slug as string,
      name: event.name as string,
      budget,
      eventDate: (event.event_date as string | null) ?? null,
      receiver: {
        firstName: firstName(displayName),
        displayName,
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
      },
      wants: (member?.wants as string | null) ?? null,
      wishes,
    };
  } catch {
    // A broken event lookup must never take discover down; fall back.
    return null;
  }
}
