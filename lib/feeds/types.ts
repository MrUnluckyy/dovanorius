/**
 * Provider-agnostic feed ingestion contract.
 *
 * Each affiliate network (AWIN today, Tradedoubler later) implements a
 * `FeedAdapter`. The importer core only ever sees `NormalizedProduct`, so
 * adding a network is a new adapter file — nothing downstream changes.
 */
import type { Readable } from "node:stream";

export type FeedNetwork = "awin" | "tradedoubler";

/** One product, mapped out of a network's own column names into our shape. */
export type NormalizedProduct = {
  network: FeedNetwork;
  /**
   * Primary key for inspo_products. For AWIN this is the raw `aw_product_id`
   * (matching the 67k rows already in the table, so imports update in place).
   * Other networks must namespace to avoid id collisions, e.g. `td-<id>`.
   */
  id: string;
  /** Advertiser/program id within the network (AWIN `merchant_id` / awinmid). */
  merchantId: string | null;
  merchantName: string | null;
  productName: string;
  brandName: string | null;
  categoryName: string | null;
  /** Selling price in `currency`. Rows without a price are skipped upstream. */
  price: number | null;
  /** "Was"/RRP price; only set when the feed reports one above `price`. */
  rrp: number | null;
  currency: string;
  imageUrl: string | null;
  /** Network-tracked outbound URL — safe to link directly. */
  deepLink: string;
  inStock: boolean;
  gender: "female" | "male" | "unisex" | null;
  season: "winter" | "summer" | "all";
  productType: string;
};

/** A single downloadable feed (one AWIN "Create-a-Feed" fid). */
export type FeedSource = {
  /** Human label for logs. */
  label: string;
  /** Fully-formed download URL (gzipped CSV for AWIN). */
  url: string;
};

export interface FeedAdapter {
  network: FeedNetwork;
  /** Resolve the set of feeds to pull, from env/config. */
  listFeeds(): FeedSource[];
  /**
   * Stream-parse a downloaded feed body into normalized products. Must not
   * buffer the whole file — feeds run to 100k+ rows.
   */
  parse(body: Readable): AsyncIterable<NormalizedProduct>;
}
