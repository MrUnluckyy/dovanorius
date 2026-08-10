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
        .select("id, slug, label_lt, label_en, gender")
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
function rotateByDay<T>(items: T[], windowSize: number): T[] {
  if (items.length <= windowSize) return items;
  const start = new Date();
  const dayOfYear = Math.floor(
    (start.getTime() - new Date(start.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const offset = dayOfYear % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)].slice(0, windowSize);
}

const SHELF_SIZE = 12;

/** The curated picks for one persona, rotated for today. */
export function usePersonaPicks(personaId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["persona-picks", personaId],
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

      return rotateByDay(picks, SHELF_SIZE);
    },
  });
}
