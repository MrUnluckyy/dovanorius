import {
  LuShirt, LuFootprints, LuSparkles, LuShoppingBag, LuGem, LuHouse,
  LuCpu, LuBlocks, LuWrench, LuBike, LuCookingPot,
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
  { key: "clothing", type: "clothing", Icon: LuShirt },
  { key: "shoes", type: "shoes", Icon: LuFootprints },
  { key: "bag", type: "bag", Icon: LuShoppingBag },
  { key: "accessory", type: "accessory", Icon: LuGem },
];

export const SORTS: InspoSort[] = [
  "recommended", "price_asc", "price_desc", "discount",
];

export const AUDIENCES: Audience[] = ["everyone", "her", "him"];

export const PRICE_BANDS: {
  key: string;
  min: number | null;
  max: number | null;
}[] = [
  { key: "all", min: null, max: null },
  { key: "under25", min: null, max: 25 },
  { key: "b25to50", min: 25, max: 50 },
  { key: "b50to100", min: 50, max: 100 },
  { key: "over100", min: 100, max: null },
];

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
  return qs ? `/discover/browse?${qs}` : "/discover/browse";
}
