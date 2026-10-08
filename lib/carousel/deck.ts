import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { loadPicks } from "@/app/admin/editorial/_lib/health";
import { MAX_PRODUCT_SLIDES } from "./copy";

// Server-only: reaches for the service-role client.

/**
 * Route handlers are not wrapped by app/admin/layout.tsx, so the is_admin gate
 * there does not cover them — each carousel route has to check for itself.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return !!data?.is_admin;
}

export type DeckProduct = {
  name: string;
  brand: string | null;
  reason: string | null;
  imageUrl: string | null;
  price: number | null;
};

export type Deck = { title: string; description: string; products: DeckProduct[] };

/**
 * The shelf's picks in curator order. Dropped products are left out: their
 * snapshot image often no longer resolves, and a post should not show a gift
 * nobody can find any more. Out-of-stock picks stay — it is an idea, not an
 * offer.
 */
export async function loadDeck(shelfId: string): Promise<Deck | null> {
  const { data: shelf } = await supabaseAdmin
    .from("gift_personas")
    .select("id, label_lt, description, kind")
    .eq("id", shelfId)
    .maybeSingle();
  if (!shelf || shelf.kind !== "editorial") return null;

  const picks = (await loadPicks([shelf.id])).get(shelf.id) ?? [];
  return {
    title: shelf.label_lt,
    description: shelf.description ?? "",
    products: picks
      .filter((p) => p.state !== "dropped")
      .slice(0, MAX_PRODUCT_SLIDES)
      .map((p) => ({
        name: p.product_name ?? p.name_snapshot ?? "",
        brand: p.brand_name ?? null,
        reason: p.reason,
        imageUrl: p.image_url ?? p.image_snapshot,
        price: p.price,
      })),
  };
}

/** Slide 0 is the cover, then one per product, then the closing slide. */
export function slideCount(deck: Deck) {
  return deck.products.length + 2;
}
