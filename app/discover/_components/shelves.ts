import { LuTag } from "react-icons/lu";
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

/**
 * ONE live shelf remains.
 *
 * Every themed shelf here was a keyword query over product_type, and that label
 * cannot say what a thing IS: `kompiuter` filled the tech shelf with laptop
 * BAGS (790 of 7,184 rows), `lego` filled toys with LEGO t-shirts and beanies,
 * `suni` put NAPAPIJRI "M-Ya-SUNI" trousers among the pet gifts. They now live
 * in `gift_personas` with kind='theme', curated weekly — see
 * scripts/refresh-personas.ts.
 *
 * "On sale" stays live on purpose: a discount is a time-sensitive property
 * rather than a theme, and a weekly-curated sale shelf would advertise prices
 * that expired days ago. It inherits the giftable + gift_score gates, so it is
 * the one place a keyword-free filter is still the right tool.
 */
export const SHELVES: ShelfDef[] = [
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
