import { MIN_ITEMS } from "@/lib/discover/shelf-rules";

/**
 * Shapes and pure derivations for the editorial admin.
 *
 * Deliberately free of any Supabase import: the client components read these
 * types and call summarise/scheduleState, and pulling `supabaseAdmin` — which
 * carries the service-role key — into a client bundle through a type import is
 * exactly the accident this split prevents. DB access lives in health.ts.
 */

/** What happened to a pick since it was chosen. */
export type PickState =
  /** In the catalogue and buyable — counts toward rendering. */
  | "live"
  /** Still in the catalogue, but usePersonaPicks will hide it. */
  | "out_of_stock"
  /** Gone from inspo_products entirely; only the snapshot remains. */
  | "dropped";

export type EditorialPick = {
  product_id: string;
  rank: number;
  reason: string | null;
  name_snapshot: string | null;
  image_snapshot: string | null;
  added_at: string;
  state: PickState;
  /** Live catalogue values; null once the product has dropped out. */
  product_name: string | null;
  image_url: string | null;
  price: number | null;
  brand_name: string | null;
  merchant_name: string | null;
};

/** Where a shelf sits relative to its own schedule and is_active flag. */
export type ScheduleState = "inactive" | "scheduled" | "live" | "ended";

export type ShelfHealth = {
  total: number;
  live: number;
  outOfStock: number;
  dropped: number;
  /** Would PersonaShelf actually render this today, if it is in its window? */
  meetsMinimum: boolean;
};

/**
 * Who a shelf is for. Discover ranking treats kid and teen shelves as
 * sensitive: they only reach the first screen when the visitor shows a reason
 * (tapped Vaikui, browsed toys). Left at the column default, every new shelf
 * was "adult", which is how "Vaikai lauke" led the page for everyone.
 */
export type ShelfAudience = "adult" | "teen" | "kid";

export const SHELF_AUDIENCES: { value: ShelfAudience; label: string }[] = [
  { value: "adult", label: "Suaugusiems" },
  { value: "teen", label: "Paaugliams" },
  { value: "kid", label: "Vaikams" },
];

export function isShelfAudience(v: unknown): v is ShelfAudience {
  return v === "adult" || v === "teen" || v === "kid";
}

export type EditorialShelf = {
  id: string;
  slug: string;
  label_lt: string;
  label_en: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  audience: ShelfAudience;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

/**
 * Mirrors the RLS predicate on gift_personas, so admin's badge and the
 * database's own answer cannot disagree.
 */
export function scheduleState(
  shelf: EditorialShelf,
  now = new Date()
): ScheduleState {
  if (!shelf.is_active) return "inactive";
  if (shelf.starts_at && new Date(shelf.starts_at) > now) return "scheduled";
  if (shelf.ends_at && new Date(shelf.ends_at) <= now) return "ended";
  return "live";
}

export function summarise(picks: EditorialPick[]): ShelfHealth {
  const live = picks.filter((p) => p.state === "live").length;
  return {
    total: picks.length,
    live,
    outOfStock: picks.filter((p) => p.state === "out_of_stock").length,
    dropped: picks.filter((p) => p.state === "dropped").length,
    meetsMinimum: live >= MIN_ITEMS,
  };
}

export { MIN_ITEMS };
