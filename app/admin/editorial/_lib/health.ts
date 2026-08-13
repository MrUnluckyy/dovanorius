import { supabaseAdmin } from "@/utils/supabase/admin";
import type { EditorialPick, EditorialShelf, PickState } from "./types";

// Server-only by construction: this module reaches for the service-role client,
// so it must never be imported from a "use client" file. Shapes and pure
// derivations live in ./types, which is what the client components import.

/**
 * Shelf readiness, computed from the intent table rather than from what
 * survived.
 *
 * /discover hides picks in two places without saying anything: PersonaShelf
 * drops the whole shelf under MIN_ITEMS, and usePersonaPicks filters
 * `in_stock === false`. On top of that the nightly import can delete a picked
 * product outright. A curator who only sees "9 picks" cannot tell which of
 * those three things happened, or whether their shelf is even on the page.
 *
 * So every pick is classified against the live catalogue and reported
 * separately. `dropped` is the one that needs the snapshot: the product row is
 * gone, and its name here is the only remaining record of what was chosen.
 */

/**
 * Classify every pick for the given shelves.
 *
 * Batched across shelves so the list page stays flat in query count regardless
 * of how many shelves exist.
 */
export async function loadPicks(
  personaIds: string[]
): Promise<Map<string, EditorialPick[]>> {
  const byShelf = new Map<string, EditorialPick[]>();
  for (const id of personaIds) byShelf.set(id, []);
  if (!personaIds.length) return byShelf;

  const { data: intents } = await supabaseAdmin
    .from("editorial_picks")
    .select(
      "persona_id, product_id, rank, reason, name_snapshot, image_snapshot, added_at"
    )
    .in("persona_id", personaIds)
    .order("rank");

  const rows = intents ?? [];
  if (!rows.length) return byShelf;

  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));

  const live = new Map<
    string,
    {
      product_name: string;
      image_url: string | null;
      price: number | null;
      brand_name: string | null;
      merchant_name: string | null;
      in_stock: boolean;
    }
  >();

  // Chunked: picks across many shelves can exceed what one `in` filter
  // comfortably carries in a request URL.
  const CHUNK = 200;
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const { data } = await supabaseAdmin
      .from("inspo_products")
      .select(
        "id, product_name, image_url, price, brand_name, merchant_name, in_stock"
      )
      .in("id", productIds.slice(i, i + CHUNK));
    for (const p of data ?? []) live.set(p.id, p);
  }

  for (const r of rows) {
    const product = live.get(r.product_id);
    const state: PickState = !product
      ? "dropped"
      : product.in_stock
        ? "live"
        : "out_of_stock";

    byShelf.get(r.persona_id)?.push({
      product_id: r.product_id,
      rank: r.rank,
      reason: r.reason,
      name_snapshot: r.name_snapshot,
      image_snapshot: r.image_snapshot,
      added_at: r.added_at,
      state,
      product_name: product?.product_name ?? null,
      image_url: product?.image_url ?? null,
      price: product?.price ?? null,
      brand_name: product?.brand_name ?? null,
      merchant_name: product?.merchant_name ?? null,
    });
  }

  return byShelf;
}

export async function loadShelves(): Promise<EditorialShelf[]> {
  const { data } = await supabaseAdmin
    .from("gift_personas")
    .select(
      "id, slug, label_lt, label_en, description, is_active, sort_order, starts_at, ends_at, created_at"
    )
    .eq("kind", "editorial")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (data ?? []) as EditorialShelf[];
}
