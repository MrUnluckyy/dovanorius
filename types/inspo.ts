/** A product row from the AWIN datafeed (`public.inspo_products`). */
export type InspoProduct = {
  id: string;
  product_name: string;
  image_url: string | null;
  /** Already an AWIN-tracked deeplink (awin1.com/pclick.php…) — safe to link directly. */
  deep_link: string | null;
  price: number | null;
  currency: string | null;
  brand_name: string | null;
  category_name: string | null;
  merchant_name: string | null;
  merchant_id: string | null;
  in_stock: boolean;
  synced_at: string | null;
  suitable_for: string | null;
  sort_key: number | null;
  gender: "female" | "male" | "unisex" | null;
  season: "winter" | "summer" | "all" | null;
  product_type: string | null;
  /** Recommended retail price, when the merchant supplies one. */
  rrp: number | null;
  /** Percent off vs. rrp (0–100), when discounted. */
  discount_pct: number | null;
  /** Who the product is for, by age. Derived in the database. */
  audience: AgeGroup | null;
  /** Lowercased, unaccented "name brand category" — the column search runs against. */
  search_norm: string | null;
  /** Which pipeline produced this served row. */
  source: "affiliate" | "partner";
  /** Set only for source='partner' rows — the partner whose approved product this is. */
  partner_id: string | null;
};

/**
 * Which gender the feed is tailored for. Orthogonal to {@link AgeGroup}: this
 * is the her/him lens, that is the kid/teen/adult one, and a shopper sets both
 * ("something for a 7-year-old girl" = ageGroup "kid" + audience "her").
 */
export type Audience = "her" | "him" | "everyone";

/**
 * Age bracket of the person being shopped for — `inspo_products.audience`.
 *
 * Split out from `product_type` because that column was answering two
 * questions at once. A child's t-shirt is `clothing`, a child's sneaker is
 * `shoes`, a child's bike is `sport`, so "Toys" was the only route to anything
 * child-related and reached 2,064 of the ~17,900 kids rows the feed carries.
 * The other half of the same bug: those rows have no gender, and the gender
 * filter keeps nulls by design, so every adult browsing saw them too.
 */
export type AgeGroup = "kid" | "teen" | "adult";

/** How the discover feed is ordered. */
export type InspoSort = "recommended" | "price_asc" | "price_desc" | "discount";

/** Filters the discover feed understands. */
export type InspoFilters = {
  merchant: string | null;
  /** product_type bucket: beauty | shoes | clothing | bag | accessory. */
  productType: string | null;
  /** Exact brand_name to narrow to, or null for all brands. */
  brand: string | null;
  priceMin: number | null;
  priceMax: number | null;
  search: string;
  /** Gender lens — see {@link Audience}. Distinct from `ageGroup`. */
  audience: Audience;
  /** Age bracket — see {@link AgeGroup}. Distinct from `audience`. */
  ageGroup: AgeGroup;
  /** When true, hide products for the opposite season to now. */
  inSeason: boolean;
  /** When true, only show discounted products. */
  onSaleOnly: boolean;
  sort: InspoSort;
};
