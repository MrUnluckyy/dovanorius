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
};

/** Who the feed is being tailored for. */
export type Audience = "her" | "him" | "everyone";

/** Filters the discover feed understands. */
export type InspoFilters = {
  merchant: string | null;
  /** product_type bucket: beauty | shoes | clothing | bag | accessory. */
  productType: string | null;
  priceMin: number | null;
  priceMax: number | null;
  search: string;
  audience: Audience;
  /** When true, hide products for the opposite season to now. */
  inSeason: boolean;
};
