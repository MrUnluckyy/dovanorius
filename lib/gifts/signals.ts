import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { RECENT_ITEMS } from "./config";

/** The raw evidence we model a person from — profile + boards + wishes + feedback. */
export type UserSignals = {
  displayName: string | null;
  about: string | null;
  age: number | null;
  boards: string[];
  items: { title: string; price: number | null; board: string }[];
  /** Products the user hearted / ✕'d on the discover feed. */
  liked: string[];
  disliked: string[];
};

/** Disliked product ids — hard-excluded from candidate retrieval. */
export async function getDislikedProductIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("product_feedback")
    .select("product_id")
    .eq("user_id", userId)
    .eq("signal", -1);
  return (data ?? []).map((r) => r.product_id);
}

export async function getUserSignals(userId: string): Promise<UserSignals> {
  const [{ data: profile }, { data: boards }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("display_name, about, date_of_birth")
      .eq("id", userId)
      .single(),
    supabaseAdmin.from("boards").select("id, name").eq("owner_id", userId),
  ]);

  const boardName = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const boardIds = (boards ?? []).map((b) => b.id);

  let items: { title: string; price: number | null; board_id: string }[] = [];
  if (boardIds.length) {
    const { data } = await supabaseAdmin
      .from("items")
      .select("title, price, board_id")
      .in("board_id", boardIds)
      .order("created_at", { ascending: false })
      .limit(RECENT_ITEMS);
    items = data ?? [];
  }

  const age = profile?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) / 3.15576e10
      )
    : null;

  // Relevance feedback → product titles, so likes/dislikes become taste evidence
  // (and change the signals hash, re-inferring the profile as the user reacts).
  const { data: fb } = await supabaseAdmin
    .from("product_feedback")
    .select("product_id, signal")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);

  const fbIds = (fb ?? []).map((f) => f.product_id);
  const titleById = new Map<string, string>();
  if (fbIds.length) {
    const { data: prods } = await supabaseAdmin
      .from("inspo_products")
      .select("id, product_name")
      .in("id", fbIds);
    for (const p of prods ?? []) titleById.set(p.id, p.product_name);
  }
  const liked = (fb ?? [])
    .filter((f) => f.signal === 1)
    .map((f) => titleById.get(f.product_id))
    .filter((t): t is string => !!t);
  const disliked = (fb ?? [])
    .filter((f) => f.signal === -1)
    .map((f) => titleById.get(f.product_id))
    .filter((t): t is string => !!t);

  return {
    displayName: profile?.display_name ?? null,
    about: profile?.about ?? null,
    age,
    boards: (boards ?? []).map((b) => b.name),
    items: items.map((i) => ({
      title: i.title,
      price: i.price,
      board: boardName.get(i.board_id) ?? "",
    })),
    liked,
    disliked,
  };
}

/** Stable fingerprint of the inputs — the taste profile is only re-inferred when this changes. */
export function signalsHash(s: UserSignals): string {
  return createHash("sha256").update(JSON.stringify(s)).digest("hex");
}
