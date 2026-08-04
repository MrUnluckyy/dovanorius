/**
 * Curation layer — the "less but better" gate applied between feed parsing and
 * staging (P2). The raw AWIN feed is ~665k rows, but ~72% of that is the same
 * products repeated once per size/colour variant. Curation:
 *
 *   1. Hard filter   — drop rows outside the giftable band (price, stock,
 *                      image/brand quality, junk titles).
 *   2. Variant collapse — keep ONE row per product concept
 *                      (merchant + brand + product_name), so 4 sizes of the same
 *                      dress become one served row.
 *   3. Optional levers — a brand allowlist and a per-merchant cap, off by
 *                      default, for tightening the set editorially later.
 *
 * Collapse assigns a STABLE synthetic id derived from the concept key, so the
 * same product keeps the same inspo_products id run to run regardless of which
 * variant the feed happens to emit first — otherwise every night would churn
 * ids and defeat the delta-merge.
 *
 * A curator instance is single-pass and stateful (dedupe set, per-merchant
 * counts). Create a fresh one per feed (see importer) so a feed retry re-runs
 * cleanly and variant collapse is scoped to the merchant's own feed.
 */
import { createHash } from "node:crypto";
import type { NormalizedProduct } from "./types";

export type CurationConfig = {
  /** Inclusive price band, in feed currency. Rows outside are dropped. */
  minPrice: number;
  maxPrice: number;
  /** Require the feed to report the row in stock. */
  requireInStock: boolean;
  /** Require a non-empty image URL. */
  requireImage: boolean;
  /** Require a non-empty brand. */
  requireBrand: boolean;
  /** Minimum trimmed product-name length. */
  minTitleLength: number;
  /** Titles matching this are treated as non-giftable (testers, refills, …). */
  junkTitle: RegExp;
  /**
   * If set, only these brands pass (case-insensitive). null = allow all brands.
   * The high-leverage editorial lever once a quality list exists.
   */
  brandAllowlist: Set<string> | null;
  /** Max kept products per merchant. Infinity = no cap. */
  perMerchantCap: number;
};

export const defaultCuration: CurationConfig = {
  minPrice: 10,
  maxPrice: 300,
  requireInStock: true,
  requireImage: true,
  requireBrand: true,
  minTitleLength: 6,
  // EN + LT non-gift signals. Conservative on purpose — the point is variant
  // collapse, not aggressive title mining.
  junkTitle:
    /\b(tester|sample|samples|miniature|travel size|refill|replacement|spare|warranty|gift ?card|e-?voucher)\b|mėginukas|papildym|dovanų ?(kupon|ček)/i,
  brandAllowlist: null,
  perMerchantCap: Infinity,
};

export type SkipReason =
  | "price"
  | "stock"
  | "image"
  | "brand"
  | "title"
  | "junk"
  | "brand_not_allowed"
  | "merchant_cap"
  | "duplicate_variant";

export type CurationStats = {
  considered: number;
  kept: number;
  skipped: Record<SkipReason, number>;
};

function emptySkips(): Record<SkipReason, number> {
  return {
    price: 0,
    stock: 0,
    image: 0,
    brand: 0,
    title: 0,
    junk: 0,
    brand_not_allowed: 0,
    merchant_cap: 0,
    duplicate_variant: 0,
  };
}

/** Normalise a text fragment for the collapse key. */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Stable id for a product concept — order-independent across feed runs. */
export function conceptId(p: NormalizedProduct): string {
  const key = `${p.network}|${norm(p.merchantId ?? p.merchantName)}|${norm(
    p.brandName
  )}|${norm(p.productName)}`;
  return "awc-" + createHash("sha1").update(key).digest("hex").slice(0, 16);
}

export type Curator = {
  /**
   * Decide a single product. Returns the row to stage (with its stable concept
   * id) or null to drop it. Records the outcome in `stats`.
   */
  consider(p: NormalizedProduct): NormalizedProduct | null;
  readonly stats: CurationStats;
};

export function createCurator(
  config: CurationConfig = defaultCuration
): Curator {
  const seen = new Set<string>();
  const perMerchant = new Map<string, number>();
  const stats: CurationStats = { considered: 0, kept: 0, skipped: emptySkips() };

  function drop(reason: SkipReason): null {
    stats.skipped[reason]++;
    return null;
  }

  return {
    stats,
    consider(p: NormalizedProduct): NormalizedProduct | null {
      stats.considered++;

      // 1. Hard filter.
      if (p.price == null || p.price < config.minPrice || p.price > config.maxPrice)
        return drop("price");
      if (config.requireInStock && !p.inStock) return drop("stock");
      if (config.requireImage && !p.imageUrl) return drop("image");
      if (config.requireBrand && !p.brandName) return drop("brand");

      const title = p.productName.trim();
      if (title.length < config.minTitleLength) return drop("title");
      if (config.junkTitle.test(`${title} ${p.categoryName ?? ""}`))
        return drop("junk");

      if (
        config.brandAllowlist &&
        !config.brandAllowlist.has(norm(p.brandName))
      )
        return drop("brand_not_allowed");

      // 2. Variant collapse — first concept wins, later variants are dropped.
      const id = conceptId(p);
      if (seen.has(id)) return drop("duplicate_variant");

      // 3. Per-merchant cap (counted on kept concepts only).
      const mkey = norm(p.merchantId ?? p.merchantName);
      const count = perMerchant.get(mkey) ?? 0;
      if (count >= config.perMerchantCap) return drop("merchant_cap");

      seen.add(id);
      perMerchant.set(mkey, count + 1);
      stats.kept++;
      return { ...p, id };
    },
  };
}
