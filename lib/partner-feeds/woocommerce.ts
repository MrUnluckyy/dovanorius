/**
 * Reads a WooCommerce storefront through the Store API.
 *
 * /wp-json/wc/store/v1/products is public and unauthenticated — it is what a
 * Woo storefront's own block UI calls — so, like Shopify, a partner gives us a
 * bare domain and nothing else. No keys, no plugin to install.
 *
 * Three things differ from Shopify in ways that are silent if missed:
 *
 *   1. The response is a BARE ARRAY, not { products: [...] }.
 *   2. Prices are MINOR UNITS in a string: "2300" with currency_minor_unit 2 is
 *      €23.00. Read as a number, every product is 100x its real price — and it
 *      would look plausible enough to reach Discover.
 *   3. The page count is in the x-wp-totalpages HEADER; the body carries no
 *      pagination at all.
 */
import {
  FeedError,
  type FeedAdapter,
  type NormalizedProduct,
  type StoreCatalog,
} from "./types";
import { getJson, stripHtml, sameHostUrl } from "./http";

/** The Store API caps per_page at 100, unlike Shopify's 250. */
const PAGE_SIZE = 100;
/** Same ~10k ceiling as the Shopify reader, at this page size. */
const MAX_PAGES = 100;

type WooPrices = {
  price?: string | null;
  regular_price?: string | null;
  currency_code?: string | null;
  currency_minor_unit?: number | null;
  price_range?: { min_amount?: string | null; max_amount?: string | null } | null;
};

type WooProduct = {
  id?: number | string;
  name?: string;
  slug?: string;
  permalink?: string;
  sku?: string | null;
  description?: string | null;
  short_description?: string | null;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  prices?: WooPrices;
  images?: { src?: string }[];
  categories?: { name?: string }[];
  tags?: { name?: string }[];
};

/**
 * "2300" + minor unit 2 -> 23. Returns null for anything not a positive number,
 * which is how a product with no sensible price is dropped rather than imported
 * at 0.
 */
function toMajorUnits(
  amount: string | null | undefined,
  minorUnit: number | null | undefined
): number | null {
  if (amount == null || amount === "") return null;
  const raw = Number(amount);
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const digits = typeof minorUnit === "number" && minorUnit >= 0 ? minorUnit : 2;
  const value = raw / 10 ** digits;
  // Guard against a store that already reports major units: a 23.00 with
  // minor_unit 2 would otherwise become 0.23. Values with a decimal point are
  // not minor units by definition.
  const looksMajor = /[.,]/.test(String(amount));
  const result = looksMajor ? raw : value;

  return Number.isFinite(result) && result > 0
    ? Math.round(result * 100) / 100
    : null;
}

function priceOf(prices: WooPrices | undefined): number | null {
  if (!prices) return null;
  const minor = prices.currency_minor_unit;
  // Variable products advertise a span; take the low end, which matches the
  // "from €X" the storefront shows and the Shopify adapter's cheapest-variant.
  const range = prices.price_range?.min_amount;
  return toMajorUnits(range ?? prices.price, minor);
}

function toCategories(p: WooProduct): string[] {
  const all = [
    ...(p.categories ?? []).map((c) => c?.name ?? ""),
    ...(p.tags ?? []).map((t) => t?.name ?? ""),
  ]
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length <= 40);
  return Array.from(new Set(all)).slice(0, 10);
}

function normalize(p: WooProduct, domain: string): NormalizedProduct | null {
  const id = p.id != null ? String(p.id) : null;
  const title = (p.name ?? "").trim();
  if (!id || !title) return null;

  // permalink is shop-controlled text that we store and later render as an
  // outbound link, so it is only trusted when it points at the registered host;
  // otherwise fall back to a URL we build ourselves.
  const productUrl =
    sameHostUrl(p.permalink, domain) ??
    (p.slug ? `https://${domain}/${p.slug}/` : null);
  if (!productUrl) return null;

  return {
    externalId: id,
    title: title.slice(0, 300),
    // short_description is the merchandising blurb; description is the full
    // spec sheet. Prefer the blurb, fall back to the long one.
    description: stripHtml(p.short_description) ?? stripHtml(p.description),
    price: priceOf(p.prices),
    imageUrl: p.images?.[0]?.src ?? null,
    productUrl,
    sku: p.sku?.trim() || null,
    inStock: p.is_in_stock !== false && p.is_purchasable !== false,
    categories: toCategories(p),
  };
}

function readPage(body: unknown): WooProduct[] {
  if (!Array.isArray(body)) {
    throw new FeedError(
      "Atsakymas nėra produktų sąrašas. Ar tai WooCommerce parduotuvė su įjungtu Store API?"
    );
  }
  return body as WooProduct[];
}

export async function fetchWooCommerceCatalog(
  domain: string
): Promise<StoreCatalog> {
  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();
  let currency = "EUR";
  let totalPages = MAX_PAGES;

  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const { body, headers } = await getJson(
      `https://${domain}/wp-json/wc/store/v1/products` +
        `?per_page=${PAGE_SIZE}&page=${page}`
    );

    if (page === 1) {
      const reported = Number(headers.get("x-wp-totalpages"));
      if (Number.isFinite(reported) && reported > 0) totalPages = reported;
    }

    const batch = readPage(body);
    if (batch.length === 0) break;

    for (const raw of batch) {
      // Currency is per-product here rather than store-wide; the first one that
      // declares it wins, which is right for a single-currency shop and is the
      // best available answer for a multi-currency one.
      const code = raw.prices?.currency_code;
      if (code) currency = code.toUpperCase();

      const item = normalize(raw, domain);
      if (item && !seen.has(item.externalId)) {
        seen.add(item.externalId);
        products.push(item);
      }
    }

    if (batch.length < PAGE_SIZE) break;
  }

  if (products.length === 0) {
    throw new FeedError("Parduotuvėje nerasta produktų.");
  }

  return { currency, products };
}

export const wooCommerceAdapter: FeedAdapter = {
  platform: "woocommerce",
  label: "WooCommerce",
  fetchCatalog: fetchWooCommerceCatalog,
  async probe(domain) {
    try {
      const { body } = await getJson(
        `https://${domain}/wp-json/wc/store/v1/products?per_page=1`
      );
      return Array.isArray(body);
    } catch {
      return false;
    }
  },
};
