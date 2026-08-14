/**
 * The contract every storefront adapter implements.
 *
 * Adapters differ only in how they read a shop; everything downstream — the
 * sync, the moderation queue, the projection into Discover — sees one shape.
 * Adding a platform should mean writing one file and registering it, never
 * touching sync.ts.
 */

/** Supported catalogue sources. Mirrors partners.feed_platform in the DB. */
export type FeedPlatform = "shopify" | "woocommerce";

export type NormalizedProduct = {
  /** Stable id in the upstream shop. Half of partner_products' unique key. */
  externalId: string;
  title: string;
  description: string | null;
  /**
   * Cheapest buyable price, in major units.
   *
   * "Cheapest" rather than "the" price because both platforms model variants:
   * it matches the "from €X" a storefront advertises, and it is the number a
   * shopper comparing gifts expects to see.
   */
  price: number | null;
  imageUrl: string | null;
  productUrl: string;
  sku: string | null;
  inStock: boolean;
  /** Shop-side taxonomy. Gift metadata (age, gender) stays partner-owned. */
  categories: string[];
};

export type StoreCatalog = {
  currency: string;
  products: NormalizedProduct[];
};

/**
 * A failure a partner can act on. The message is shown to them verbatim in the
 * partner panel and persisted to partners.feed_last_error, so it is written in
 * Lithuanian and names the fix rather than the stack.
 */
export class FeedError extends Error {}

/** Reads one shop's public catalogue. */
export type FeedAdapter = {
  platform: FeedPlatform;
  /** For error copy and the partner panel badge. */
  label: string;
  fetchCatalog: (domain: string) => Promise<StoreCatalog>;
  /**
   * Cheap probe used by detectPlatform: does this domain look like this
   * platform? Must not throw — resolve false instead.
   */
  probe: (domain: string) => Promise<boolean>;
};
