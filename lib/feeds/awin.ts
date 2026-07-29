/**
 * AWIN "Create-a-Feed" adapter.
 *
 * Consumes the downloadable gzipped CSV feed. Configure via env:
 *
 *   AWIN_DATAFEED_KEY — the datafeed API key (AWIN → Toolbox → Create-a-Feed;
 *                    the 32-char hex key, NOT the Partner API token). Falls back
 *                    to AWIN_DATAFEED_TOKEN, then AWIN_API_KEY.
 *   AWIN_FEED_IDS  — comma-separated feed ids (fid) to pull.
 *   AWIN_FEED_URL  — optional: a full pre-built feed URL. If set, it wins and
 *                    the key/feed-id vars are ignored (one feed only).
 *
 * The column set below must match the columns selected when building the feed
 * in AWIN. Missing columns are tolerated (mapped to null); the four required to
 * store a row are aw_product_id, product_name, aw_deep_link and search_price.
 */
import { parse } from "csv-parse";
import type { Readable } from "node:stream";
import { classifyGender, classifyProductType, classifySeason } from "./classify";
import type { FeedAdapter, FeedSource, NormalizedProduct } from "./types";

/** Columns requested in the feed URL (order/content must match AWIN setup). */
export const AWIN_COLUMNS = [
  "aw_product_id",
  "product_name",
  "aw_deep_link",
  "merchant_image_url",
  "search_price",
  "rrp_price",
  "base_price",
  "currency",
  "brand_name",
  "merchant_category",
  "category_name",
  "merchant_name",
  "merchant_id",
  "in_stock",
  "Fashion:suitable_for",
] as const;

function buildFeedUrl(apiKey: string, feedId: string): string {
  const cols = AWIN_COLUMNS.join(",");
  return (
    `https://productdata.awin.com/datafeed/download/apikey/${apiKey}` +
    `/language/lt/fid/${feedId}` +
    `/columns/${cols}` +
    `/format/csv/delimiter/%2C/compression/gzip/`
  );
}

/** First non-empty value among the given keys of a CSV record. */
function pick(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v.trim() !== "") return v.trim();
  }
  return null;
}

function toNumber(v: string | null): number | null {
  if (v == null) return null;
  const n = Number.parseFloat(v.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: string | null): boolean {
  if (v == null) return true; // absent stock column → assume available
  return /^(1|true|yes|in ?stock|available)$/i.test(v.trim());
}

function mapRow(row: Record<string, string>): NormalizedProduct | null {
  const id = pick(row, "aw_product_id", "product_id");
  const productName = pick(row, "product_name");
  const deepLink = pick(row, "aw_deep_link", "deep_link");
  const price = toNumber(pick(row, "search_price", "store_price", "display_price"));
  if (!id || !productName || !deepLink || price == null) return null;

  const rrpRaw = toNumber(pick(row, "rrp_price", "base_price", "store_price"));
  const rrp = rrpRaw != null && rrpRaw > price ? rrpRaw : null;

  const merchantName = pick(row, "merchant_name");
  const categoryName = pick(row, "merchant_category", "category_name");
  const suitableFor = pick(row, "Fashion:suitable_for", "suitable_for");

  return {
    network: "awin",
    id,
    merchantId: pick(row, "merchant_id"),
    merchantName,
    productName,
    brandName: pick(row, "brand_name"),
    categoryName,
    price,
    rrp,
    currency: pick(row, "currency") ?? "EUR",
    imageUrl: pick(row, "merchant_image_url", "aw_image_url", "large_image"),
    deepLink,
    inStock: toBool(pick(row, "in_stock", "stock_status")),
    gender: classifyGender(suitableFor, productName),
    season: classifySeason(productName),
    productType: classifyProductType(categoryName, merchantName, productName),
  };
}

export const awinAdapter: FeedAdapter = {
  network: "awin",

  listFeeds(): FeedSource[] {
    const explicit = process.env.AWIN_FEED_URL?.trim();
    if (explicit) return [{ label: "awin:custom-url", url: explicit }];

    const apiKey = (
      process.env.AWIN_DATAFEED_KEY ??
      process.env.AWIN_DATAFEED_TOKEN ??
      process.env.AWIN_API_KEY
    )?.trim();
    const feedIds = (process.env.AWIN_FEED_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!apiKey) throw new Error("AWIN_DATAFEED_KEY is not set");
    if (!feedIds.length) throw new Error("AWIN_FEED_IDS is not set");

    return feedIds.map((fid) => ({
      label: `awin:fid=${fid}`,
      url: buildFeedUrl(apiKey, fid),
    }));
  },

  async *parse(body: Readable): AsyncIterable<NormalizedProduct> {
    const parser = body.pipe(
      parse({
        columns: true,
        delimiter: ",",
        relax_quotes: true,
        relax_column_count: true,
        skip_records_with_error: true,
        trim: true,
      })
    );
    for await (const row of parser) {
      const product = mapRow(row as Record<string, string>);
      if (product) yield product;
    }
  },
};
