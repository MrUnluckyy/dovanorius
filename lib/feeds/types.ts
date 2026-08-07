/**
 * Provider-agnostic feed ingestion contract.
 *
 * Each affiliate network (AWIN today, Tradedoubler later) implements a
 * `FeedAdapter`. The importer core only ever sees `NormalizedProduct`, so
 * adding a network is a new adapter file — nothing downstream changes.
 */
import type { Readable } from "node:stream";
// Type-only cycle (curate.ts imports NormalizedProduct from here); erased at
// compile time, so it costs nothing at runtime.
import type { CurationConfig } from "./curate";

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
  /**
   * Optional override for the curator's variant-collapse key, for feeds where
   * brand+name does not identify one product (e.g. About You bakes the colour
   * into the title, so only the deeplink's product id groups the variants).
   * Null/absent = collapse on brand+name as usual.
   */
  conceptKey?: string | null;
};

/** A single downloadable feed (one AWIN "Create-a-Feed" fid, one TD fid). */
export type FeedSource = {
  /** Human label for logs. */
  label: string;
  /** Fully-formed download URL (gzipped CSV for AWIN). */
  url: string;
  /**
   * Body encoding. Defaults to "gzip" — AWIN's Create-a-Feed always serves a
   * gzip stream, while TradeDoubler serves plain JSON.
   */
  compression?: "gzip" | "none";
  /**
   * Per-feed curation overrides, merged over the run's config. Networks whose
   * feeds disagree on which fields exist (TradeDoubler) need this: requiring a
   * brand is right for one feed and empties another.
   */
  curate?: Partial<CurationConfig>;
  /**
   * Adapter-owned download, when a plain fetch is not enough — TradeDoubler's
   * bulk export is generated asynchronously and has to be polled for.
   */
  download?: (log: (msg: string) => void) => Promise<Readable>;
  /**
   * Per-feed parser, for networks where mapping depends on which feed the row
   * came from. Falls back to the adapter's `parse` when absent.
   */
  parse?: (body: Readable) => AsyncIterable<NormalizedProduct>;
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
