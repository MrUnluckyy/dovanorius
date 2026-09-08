import {
  LuShirt, LuFootprints, LuSparkles, LuShoppingBag, LuGem, LuHouse,
  LuCpu, LuBlocks, LuWrench, LuBike, LuCookingPot, LuSprout, LuPawPrint,
  LuPackage,
} from "react-icons/lu";
import type { AgeGroup, Audience, InspoSort } from "@/types/inspo";

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
  // `other` is a real bucket holding a few thousand giftable rows, and while no
  // pill pointed at it they were unreachable by browsing at all -- including
  // most of mideer's kids range, whose breadcrumbs are bare product families.
  // Last in the rail, because it is a remainder rather than a category.
  { key: "other", type: "other", Icon: LuPackage },
];

/**
 * Age brackets, widest first. Not a filter among filters: the feed always pins
 * exactly one, so this is the primary "who am I shopping for" choice and the
 * only route to the kids catalogue.
 */
export const AGE_GROUPS: AgeGroup[] = ["adult", "teen", "kid"];

/** The bracket assumed when nobody has chosen one. */
export const DEFAULT_AGE_GROUP: AgeGroup = "adult";

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
  age?: AgeGroup | null;
}): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  // Unlike the gender lens, the age bracket IS shareable: "here are gift ideas
  // for a 7-year-old" is the whole point of the link, and it carries nothing
  // personal about the sender.
  if (params.age && params.age !== DEFAULT_AGE_GROUP) sp.set("age", params.age);
  if (params.price && params.price !== "all") sp.set("price", params.price);
  if (params.brand) sp.set("brand", params.brand);
  if (params.sort && params.sort !== "recommended") sp.set("sort", params.sort);
  if (params.q) sp.set("q", params.q);
  if (params.sale) sp.set("sale", "1");
  const qs = sp.toString();
  return qs ? `/discover/browse?${qs}` : "/discover/browse";
}
