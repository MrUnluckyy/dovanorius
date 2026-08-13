import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { InspoProduct } from "@/types/inspo";

/**
 * Recipient personas and their pre-curated shelves.
 *
 * Both tables are public-read, so this works for logged-out visitors — which is
 * the point. The personal AI strip needs an account and enough history; a
 * persona needs neither, because the shopper states who they are buying for.
 *
 * Nothing here calls an LLM. Picks were curated offline by
 * scripts/refresh-personas.ts and are just read back.
 */
export type GiftPersona = {
  id: string;
  slug: string;
  label_lt: string;
  label_en: string;
  gender: "female" | "male" | null;
  /**
   * Reused by the "view more" continuation, not just curation: the shelf
   * already declares what does not belong on it, and the second tier needs the
   * same guard or it re-imports exactly what the curator threw out.
   */
  exclude_keywords: string[];
  /**
   * recipient = offered in the picker, shown when chosen.
   * theme = a themed shelf rendered inline, still LLM-curated.
   * editorial = hand-picked in /admin, scheduled, never touched by the curator.
   */
  kind: "recipient" | "theme" | "editorial";
};

export type PersonaPick = InspoProduct & { reason: string | null };

/** Active personas, in curator-defined order. */
export function usePersonas() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["gift-personas"],
    staleTime: 1000 * 60 * 60, // personas change when someone edits a row, not per visit
    queryFn: async (): Promise<GiftPersona[]> => {
      const { data, error } = await supabase
        .from("gift_personas")
        .select("id, slug, label_lt, label_en, gender, kind, exclude_keywords")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as GiftPersona[];
    },
  });
}

/**
 * Rotate a shelf by the day of the year.
 *
 * The curator stores ~40 picks but a shelf shows ~12, so rotating the window
 * daily gives the page fresh faces without another LLM call. Deterministic
 * within a day, which keeps it cacheable and means two visitors see the same
 * thing — a shuffle on every render would make the page feel unstable and break
 * the "I saw it earlier, where is it" case.
 */
function rotateByDay<T>(items: T[]): T[] {
  if (items.length < 2) return items;
  const start = new Date();
  const dayOfYear = Math.floor(
    (start.getTime() - new Date(start.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const offset = dayOfYear % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/** How many picks a collapsed shelf shows; "view more" reveals the rest. */
export const SHELF_SIZE = 12;

/**
 * ALL of a persona's curated picks, rotated for today.
 *
 * Returns the full set rather than the visible window: "view more" expands in
 * place, so the extra picks must already be here — a second fetch on click would
 * make the reveal feel like a page load.
 *
 * `rotate: false` for hand-picked editorial shelves. Rotation exists because the
 * LLM stores ~40 picks for a 12-slot shelf and daily movement is free variety;
 * on a shelf someone ordered by hand it is not variety, it is overriding the
 * curator — the item they deliberately put first would lead the shelf on only
 * one day in twelve.
 */
export function usePersonaPicks(
  personaId: string | null,
  opts?: { rotate?: boolean }
) {
  const supabase = createClient();
  const rotate = opts?.rotate ?? true;

  return useQuery({
    queryKey: ["persona-picks", personaId, rotate],
    enabled: !!personaId,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<PersonaPick[]> => {
      const { data, error } = await supabase
        .from("persona_products")
        .select("rank, reason, inspo_products!inner(*)")
        .eq("persona_id", personaId!)
        .order("rank");
      if (error) throw error;

      const rows = (data ?? []) as unknown as {
        reason: string | null;
        inspo_products: InspoProduct;
      }[];

      // A pick whose product went out of stock since the last curation run
      // should not surface; the weekly refresh will replace it.
      const picks = rows
        .filter((r) => r.inspo_products?.in_stock)
        .map((r) => ({ ...r.inspo_products, reason: r.reason }));

      return rotate ? rotateByDay(picks) : picks;
    },
  });
}

/**
 * The second tier behind "view more": everything else in the categories this
 * shelf actually produced.
 *
 * The filter is derived from the shelf's own picks rather than the persona's
 * configured `product_types`, because every theme now lists `other` — 114k rows
 * — in its pool config. Using that would open the floodgates; using what the
 * curator actually chose keeps the continuation recognisably related, and it
 * tightens by itself as curation improves.
 *
 * This tier is explicitly NOT curated, and the UI says so. That honesty is the
 * whole design: relevance does not feel broken when people know they have
 * crossed from "we picked these" into "everything in this category".
 */
export function useShelfContinuation(
  types: string[],
  excludeIds: string[],
  excludeKeywords: string[],
  enabled: boolean
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["shelf-more", types, excludeIds.length, excludeKeywords],
    enabled: enabled && types.length > 0,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<InspoProduct[]> => {
      const { data, error } = await supabase
        .from("inspo_products")
        .select("*")
        .eq("in_stock", true)
        .eq("giftable", true)
        .not("image_url", "is", null)
        .not("deep_link", "is", null)
        .in("product_type", types)
        .gte("gift_score", 45)
        .order("gift_score", { ascending: false })
        .order("sort_key", { ascending: true })
        // Over-fetch: the keyword guard below can reject a lot. On the tech
        // shelf it removes nearly every high-scoring row, because `tech` still
        // contains 790 laptop bags that outrank real gadgets on brand + price.
        .limit(200);
      if (error) throw error;

      const seen = new Set(excludeIds);
      const banned = excludeKeywords.map((k) => k.toLowerCase()).filter(Boolean);

      return ((data ?? []) as InspoProduct[])
        .filter((p) => {
          if (seen.has(p.id)) return false;
          const name = (p.product_name ?? "").toLowerCase();
          return !banned.some((k) => name.includes(k));
        })
        .slice(0, 24);
    },
  });
}
