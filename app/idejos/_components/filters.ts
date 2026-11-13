import {
  LuShirt, LuFootprints, LuSparkles, LuShoppingBag, LuGem, LuHouse,
  LuCpu, LuBlocks, LuWrench, LuBike, LuCookingPot, LuSprout, LuPawPrint,
} from "react-icons/lu";
import type { Audience, InspoSort } from "@/types/inspo";

/**
 * Filter vocabulary shared by /discover and /discover/browse.
 *
 * Lives here rather than in either page because these values now appear in
 * URLs: `?type=beauty&price=under25` is a link someone can send. The two routes
 * must agree on the spelling of every key, and a category rail on the inspire
 * page has to produce links the browse page can read back.
 *
 * Mirrors the widened product_type taxonomy — the non-fashion buckets were
 * unreachable before, which left a third of the catalogue unbrowsable.
 */
export const CATEGORIES = [
  { key: "home", type: "home", Icon: LuHouse },
  { key: "beauty", type: "beauty", Icon: LuSparkles },
  { key: "tech", type: "tech", Icon: LuCpu },
  { key: "toys", type: "toys", Icon: LuBlocks },
  { key: "tools", type: "tools", Icon: LuWrench },
  { key: "sport", type: "sport", Icon: LuBike },
  { key: "kitchen", type: "kitchen", Icon: LuCookingPot },
  // garden and pets were omitted while the catalogue held none of either. The
  // 2026-08-13 Pigu feed switch brought in 920 and 623, which were unreachable
  // until these existed -- the classifier can produce a product_type that no
  // filter offers, and nothing surfaces the mismatch.
  { key: "garden", type: "garden", Icon: LuSprout },
  { key: "pets", type: "pets", Icon: LuPawPrint },
  { key: "clothing", type: "clothing", Icon: LuShirt },
  { key: "shoes", type: "shoes", Icon: LuFootprints },
  { key: "bag", type: "bag", Icon: LuShoppingBag },
  { key: "accessory", type: "accessory", Icon: LuGem },
];

export const SORTS: InspoSort[] = [
  "recommended", "price_asc", "price_desc", "discount",
];

export const AUDIENCES: Audience[] = ["everyone", "her", "him"];

export type PriceBand = { key: string; min: number | null; max: number | null };

/**
 * Gift budgets cluster at 20, 50 and 100 € (people say "iki 20 €", and so
 * does our own Secret Santa guide). Any "iki<N>" key also works, for a
 * Secret Santa budget or a search like "kvepalai iki 30 eur".
 */
export const PRICE_BANDS: PriceBand[] = [
  { key: "all", min: null, max: null },
  { key: "under20", min: null, max: 20 },
  { key: "b20to50", min: 20, max: 50 },
  { key: "b50to100", min: 50, max: 100 },
  { key: "over100", min: 100, max: null },
];

/** The band for a URL key, including "iki<N>" and the old "under25". */
export function priceBand(key: string | null | undefined): PriceBand {
  const fixed = PRICE_BANDS.find((b) => b.key === key);
  if (fixed) return fixed;
  const upTo = /^iki(\d{1,4})$/.exec(key ?? "")?.[1] ?? (key === "under25" ? "25" : null);
  return upTo ? { key: key!, min: null, max: Number(upTo) } : PRICE_BANDS[0];
}

/** "Iki 20 €", "20–50 €", "Iki 35 €". */
export function priceBandLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  band: PriceBand
): string {
  return PRICE_BANDS.some((b) => b.key === band.key)
    ? t(`price.${band.key}`)
    : t("price.upTo", { max: band.max ?? 0 });
}

/** Build a browse URL. The single place query-param spelling is decided. */
export function browseHref(params: {
  type?: string | null;
  price?: string | null;
  brand?: string | null;
  sort?: InspoSort | null;
  q?: string | null;
  sale?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.price && params.price !== "all") sp.set("price", params.price);
  if (params.brand) sp.set("brand", params.brand);
  if (params.sort && params.sort !== "recommended") sp.set("sort", params.sort);
  if (params.q) sp.set("q", params.q);
  if (params.sale) sp.set("sale", "1");
  const qs = sp.toString();
  return qs ? `/idejos/visos?${qs}` : "/idejos/visos";
}

/**
 * The price band a gift budget falls into, for "ideas within budget" links
 * (Secret Santa). The band containing the budget, not the one below it: a
 * €30 cap should still show the €25–50 ideas.
 */
export function bandForBudget(budget: number | null | undefined): string | null {
  if (budget == null || !Number.isFinite(budget) || budget <= 0) return null;
  // The exact budget: a 20 € Secret Santa should not be shown 25 € gifts.
  return `iki${Math.round(budget)}`;
}
