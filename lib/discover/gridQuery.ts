/**
 * The discover grid's query, as plain data, shared by the browser
 * (useInspoProducts) and the server (ssrGrid.server.ts). The server renders
 * the grid's first page into the HTML so search engines see products; the
 * browser then adopts that page as its first page. That only works when both
 * sides build the identical query, which is why it lives here and nowhere else.
 */
import type { InspoFilters, InspoProduct } from "@/types/inspo";
import { recipientLens, type RecipientKey, type VisitorGender } from "./recipients";
import { categoriesFor } from "./routes";
import { GIFT_TYPES, type Occasion } from "./occasions";

export const INSPO_PAGE_SIZE = 24;

// Quality floor: drop the cheap tail (samples/testers) so the feed stays
// "gift-worthy", not a bargain bin. Feed min price is ~€6.
export const PRICE_FLOOR = 10;

/** Northern-hemisphere season to hide when "in season" is on. null = shoulder
 * months, hide nothing. */
export function offSeasonToHide(month: number): "winter" | "summer" | null {
  if (month === 11 || month === 0 || month === 1) return "summer"; // Dec–Feb
  if (month >= 5 && month <= 7) return "winter"; // Jun–Aug
  return null; // spring / autumn: show everything
}

/** discover_page() arguments for one page of a browse (non-search) query. */
export function discoverPageArgs(filters: InspoFilters, cursor: string | null) {
  return {
    p_product_type: filters.productType,
    p_product_types: filters.productTypes?.length ? filters.productTypes : null,
    p_audience: filters.audience === "everyone" ? null : filters.audience,
    p_brand: filters.brand,
    p_merchant: filters.merchant,
    p_price_min: Math.max(PRICE_FLOOR, filters.priceMin ?? 0),
    p_price_max: filters.priceMax,
    p_on_sale: filters.onSaleOnly,
    p_hide_season: filters.inSeason ? offSeasonToHide(new Date().getMonth()) : null,
    p_sort: filters.sort,
    p_cursor: cursor,
    p_limit: INSPO_PAGE_SIZE,
    p_age_group: filters.ageGroup ?? null,
    // Only sent when set, so a database without the parameter still answers.
    ...(filters.boostTypes?.length && !filters.productType ? { p_boost_types: filters.boostTypes } : {}),
  };
}

/**
 * Types a recipient's grid pulls forward (two rounds early in the mix), so
 * pages for related people don't open on the same products: "Dovanos mamai"
 * leads with home, kitchen and garden, "Dovanos draugei" with beauty and
 * accessories, while "Dovanos moteriai" stays the plain mix.
 */
const BOOST: Partial<Record<RecipientKey, string[]>> = {
  mom: ["home", "kitchen", "garden"],
  friend: ["beauty", "accessory"],
  couple: ["home", "kitchen"],
};

const APPAREL = new Set(["clothing", "shoes", "bag"]);

/** What a discover page's grid shows: the recipient's lens, narrowed to the
 *  category when there is one. */
export function ideasGridScope(
  recipient: RecipientKey | null,
  category: string | null,
  gender: VisitorGender,
  occasion: Occasion | null = null
) {
  const lens = recipientLens(recipient, gender);
  if (occasion) {
    // An occasion draws from its own categories (all gift ones by default),
    // narrowed to what the chosen recipient's page offers.
    const types = occasion.gridTypes ?? GIFT_TYPES;
    const forRecipient = recipient ? categoriesFor(recipient, gender).filter((c) => types.includes(c)) : types;
    const productType = lens.gridType && types.includes(lens.gridType) ? lens.gridType : null;
    return {
      audience: lens.audience,
      productType,
      productTypes: forRecipient.length ? forRecipient : types,
      ageGroup: lens.ageGroup,
    };
  }
  return {
    audience: lens.audience,
    productType: category ?? lens.gridType,
    // A recipient page's grid stays inside that recipient's gift categories,
    // minus apparel: default browse is mostly fashion, and a page called
    // "Dovanos moteriai" should not open on cycling shorts.
    // The discover home (no recipient) draws from the gift categories only:
    // unfiltered, the feed is mostly clothes and unclassified rows.
    productTypes: recipient
      ? categoriesFor(recipient, gender).filter((c) => !APPAREL.has(c))
      : category
        ? undefined
        : GIFT_TYPES,
    ageGroup: lens.ageGroup,
    boostTypes: recipient && !category ? (BOOST[recipient] ?? null) : null,
  };
}

/** The grid's full filter set. Key order is fixed: its JSON is the cache key. */
export function ideasGridFilters(scope: {
  audience: InspoFilters["audience"];
  productType: string | null;
  productTypes?: string[];
  ageGroup?: InspoFilters["ageGroup"];
  priceMin?: number | null;
  priceMax?: number | null;
  boostTypes?: string[] | null;
}): InspoFilters {
  return {
    merchant: null,
    productType: scope.productType,
    productTypes: scope.productType ? null : scope.productTypes ?? null,
    ageGroup: scope.ageGroup ?? null,
    brand: null,
    priceMin: scope.priceMin ?? null,
    priceMax: scope.priceMax ?? null,
    search: "",
    audience: scope.audience,
    inSeason: true,
    onSaleOnly: false,
    sort: "recommended",
    boostTypes: scope.boostTypes ?? null,
  };
}

/** A grid page rendered on the server (see ssrGrid.server.ts). */
export type InitialGrid = {
  /** JSON of the filters it was fetched for; the grid adopts it only on a match. */
  key: string;
  products: InspoProduct[];
};
