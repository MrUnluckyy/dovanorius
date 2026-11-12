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
import type { CurationConfig } from "./curate";
import type { FeedAdapter, FeedSource, NormalizedProduct } from "./types";

/**
 * Per-feed overrides, keyed by fid. Most AWIN feeds map cleanly with the
 * generic mapper; these are the ones that don't.
 */
type AwinFeedProfile = {
  /** Display name, when AWIN's programme name is not the shop's name. */
  merchantName?: string;
  /**
   * "name-prefix": the feed leaves brand_name empty but every title starts
   * "<Brand>, <product>" (iHerb: "NOW Foods, Eteriniai aliejai, …").
   */
  brandFrom?: "name-prefix";
  /** Fixed product_type, when the feed's categories don't classify. */
  productType?: string;
  /** Filter on the mapped product, for feeds that are mostly not gifts. */
  keep?: (p: NormalizedProduct) => boolean;
  curate?: Partial<CurationConfig>;
};

/**
 * iHerb's everyday consumables. Even inside Beauty and Bath & Personal Care a
 * lot of the catalogue is a refill, not a present.
 */
const IHERB_NOT_GIFTS =
  /dezodorant|dant(ų|u) pasta|burnos skalav|plauk(ų|u) daž|tampon|įklotai|higienin|tualetin|skalbim|valikl|muil(as|o) papild|sauskelnės|kapsul|tablet|guminuk|miltel/i;

export const AWIN_FEED_PROFILES: Record<string, AwinFeedProfile> = {
  // iHerb EUR — Lithuania feed (programme 76734). Assessed 2026-11-12: 29.9k
  // rows, Lithuanian titles, links to the LT/EUR store. Half of it is
  // supplements and another fifth groceries, sports nutrition and pet food, so
  // only the Beauty and Bath & Personal Care departments (~6k rows: K-beauty
  // skincare, makeup palettes, body butters, essential oils) are imported.
  "116278": {
    merchantName: "iHerb",
    brandFrom: "name-prefix",
    // "Bath & Personal Care" classifies as "other"; everything kept is beauty.
    productType: "beauty",
    keep: (p) =>
      /^(Beauty|Bath & Personal Care)$/.test(p.categoryName ?? "") &&
      !IHERB_NOT_GIFTS.test(p.productName),
    // Under €15 is the everyday tube, not a gift.
    curate: { minPrice: 15 },
  },
};

/** "NOW Foods, Eteriniai aliejai, …" → "NOW Foods". */
function brandFromNamePrefix(name: string): string | null {
  const i = name.indexOf(",");
  if (i <= 0 || i > 40) return null;
  return name.slice(0, i).trim() || null;
}

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

    return feedIds.map((fid) => {
      const profile = AWIN_FEED_PROFILES[fid];
      return {
        label: `awin:fid=${fid}`,
        url: buildFeedUrl(apiKey, fid),
        curate: profile?.curate,
        parse: profile ? (body) => parseCsv(body, profile) : undefined,
      };
    });
  },

  parse(body: Readable): AsyncIterable<NormalizedProduct> {
    return parseCsv(body);
  },
};

async function* parseCsv(
  body: Readable,
  profile?: AwinFeedProfile
): AsyncIterable<NormalizedProduct> {
  const parser = parse({
    columns: true,
    delimiter: ",",
    relax_quotes: true,
    relax_column_count: true,
    skip_records_with_error: true,
    trim: true,
  });
  // .pipe() does not forward source errors, so a mid-download reset on `body`
  // would otherwise surface as an unhandled 'error' event and crash the
  // process. Forward it so the `for await` below rejects and the caller can
  // retry the feed.
  body.on("error", (err) => parser.destroy(err));
  body.pipe(parser);
  for await (const row of parser) {
    const mapped = mapRow(row as Record<string, string>);
    if (!mapped) continue;
    const product = profile ? applyProfile(mapped, profile) : mapped;
    if (!profile?.keep || profile.keep(product)) yield product;
  }
}

function applyProfile(p: NormalizedProduct, profile: AwinFeedProfile): NormalizedProduct {
  const brandName =
    p.brandName ??
    (profile.brandFrom === "name-prefix" ? brandFromNamePrefix(p.productName) : null);
  const merchantName = profile.merchantName ?? p.merchantName;
  return {
    ...p,
    brandName,
    merchantName,
    productType:
      profile.productType ??
      classifyProductType(p.categoryName, merchantName, p.productName),
  };
}
