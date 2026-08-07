import {
  LuGift,
  LuHouse,
  LuWrench,
  LuCpu,
  LuSparkles,
  LuBlocks,
  LuBike,
  LuCookingPot,
  LuTag,
  LuGem,
  LuFlower2,
  LuPawPrint,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import type { Audience } from "@/types/inspo";
import type { ShelfQuery } from "@/hooks/useInspoShelf";

/**
 * The editorial spine of the discover page.
 *
 * Each shelf is a themed slice with a reason to exist, which is the difference
 * between a gift page and a catalogue. Order matters: the first three are what
 * most people ever see, so they lead with breadth (a price point everyone can
 * act on) rather than a category someone may not care about.
 *
 * `minScore` is the quality floor from `gift_score`. Shelves near the top of the
 * page carry a higher one — a weak item is more damaging in the first shelf than
 * the seventh.
 */
export type ShelfDef = {
  /** i18n key under Discover.shelves.<key>.{title,subtitle} */
  key: string;
  Icon: IconType;
  query: ShelfQuery;
  /** Shown only for these audiences. Undefined = always. */
  audiences?: Audience[];
};

export const SHELVES: ShelfDef[] = [
  {
    key: "under25",
    Icon: LuGift,
    query: { priceMax: 25, minScore: 55, limit: 12 },
  },
  {
    key: "home",
    Icon: LuHouse,
    query: { productType: "home", minScore: 50, limit: 12 },
  },
  {
    key: "beauty",
    Icon: LuSparkles,
    query: { productType: "beauty", minScore: 50, limit: 12 },
  },
  {
    key: "tech",
    Icon: LuCpu,
    query: { productType: "tech", minScore: 45, limit: 12 },
  },
  {
    key: "toys",
    Icon: LuBlocks,
    query: { productType: "toys", minScore: 45, limit: 12 },
  },
  {
    key: "tools",
    Icon: LuWrench,
    query: { productType: "tools", minScore: 45, limit: 12 },
  },
  {
    key: "sport",
    Icon: LuBike,
    query: { productType: "sport", minScore: 45, limit: 12 },
  },
  {
    key: "kitchen",
    Icon: LuCookingPot,
    query: { productType: "kitchen", minScore: 45, limit: 12 },
  },
  {
    key: "accessories",
    Icon: LuGem,
    query: { productTypes: ["accessory", "bag"], minScore: 50, limit: 12 },
  },
  {
    key: "garden",
    Icon: LuFlower2,
    query: { productType: "garden", minScore: 40, limit: 12 },
  },
  {
    key: "pets",
    Icon: LuPawPrint,
    query: { productType: "pets", minScore: 40, limit: 12 },
  },
  {
    key: "onSale",
    Icon: LuTag,
    query: { onSale: true, minScore: 45, limit: 12 },
  },
];

/** product_type a shelf maps to when "see all" hands it to browse mode. */
export function shelfToFilters(shelf: ShelfDef): {
  productType: string | null;
  priceMax: number | null;
  onSaleOnly: boolean;
} {
  return {
    productType: shelf.query.productType ?? null,
    priceMax: shelf.query.priceMax ?? null,
    onSaleOnly: !!shelf.query.onSale,
  };
}
