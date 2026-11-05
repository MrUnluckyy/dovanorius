/**
 * Reads a Hostinger Website Builder (ex-Zyro) store.
 *
 * The storefront's own shop page calls a public, unauthenticated API:
 *
 *   https://api-ecommerce.hostinger.com/store/{channelId}/products?offset=&limit=
 *
 * so, like Shopify and WooCommerce, a partner gives us a bare domain and
 * nothing else. What differs, in ways that are silent if missed:
 *
 *   1. The API is NOT on the shop's domain. We need the shop's sales-channel id
 *      ("scha_" + a 26-char ULID), and the only place it is published is the
 *      site's own HTML. So the domain is read first, the id scraped from it, and
 *      only then is the API called. The API host is fixed here, never taken
 *      from the page, so a hostile page cannot point the fetch elsewhere.
 *   2. Prices are MINOR UNITS as integers: amount 22900 is €229.00. A
 *      sale_amount, when set, is what the shopper actually pays.
 *   3. Pagination is offset/limit with a total `count` in the body.
 *
 * The API is undocumented. It is what Hostinger's own storefront uses, so it is
 * stable in practice, but a shape change surfaces as a FeedError on the partner
 * panel rather than as wrong data.
 */
import {
  FeedError,
  type FeedAdapter,
  type NormalizedProduct,
  type StoreCatalog,
} from "./types";
import { decodeEntities, getJson, getText, sameHostUrl, stripHtml } from "./http";

const API_BASE = "https://api-ecommerce.hostinger.com/store";
const PAGE_SIZE = 50;
/** Same ~10k ceiling as the other readers. */
const MAX_PAGES = 200;

/** Crockford base32 ULID, as Hostinger uses for every id. */
const CHANNEL_ID_RE = /\bscha_[0-9A-HJKMNP-TV-Z]{26}\b/g;

/**
 * Markers that a page was published by Hostinger's builder. Used only to give a
 * useful error ("this is Hostinger, but we couldn't find the store") instead of
 * the generic "unrecognised platform".
 */
const BUILDER_MARKERS = [/hostinger (ai )?builder/i, /zyrosite\.com/i];

type HostingerPrice = {
  amount?: number | null;
  sale_amount?: number | null;
  currency_code?: string | null;
  currency?: { code?: string | null; decimal_digits?: number | null } | null;
};

type HostingerVariant = {
  id?: string;
  sku?: string | null;
  prices?: HostingerPrice[];
  manage_inventory?: boolean;
  inventory_quantity?: number | null;
};

type HostingerImage = { url?: string | null } | string;

export type HostingerProduct = {
  id?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  slug?: string | null;
  url_handle?: string | null;
  images?: HostingerImage[];
  variants?: HostingerVariant[];
  product_collections?: unknown[];
  type?: { value?: string } | string | null;
  purchasable?: boolean;
  is_available?: boolean;
  seo_settings?: { slug?: string | null } | null;
};

type HostingerPage = {
  products?: HostingerProduct[];
  count?: number;
};

/** channelId is null when the site is Hostinger-built but has no store on it. */
export type HostingerStoreRef = { channelId: string | null; isBuilderSite: boolean };

/**
 * Find the sales-channel id in a page's markup.
 *
 * Exported for tests. If a page somehow carries more than one (an embedded
 * second store), the most frequent wins — the shop's own channel is repeated
 * across its product blocks, a stray embed appears once.
 */
export function extractChannelId(html: string): string | null {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(CHANNEL_ID_RE)) {
    counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, n] of counts) {
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  return best;
}

async function findStore(domain: string): Promise<HostingerStoreRef | null> {
  const html = await getText(`https://${domain}/`);
  const isBuilderSite = BUILDER_MARKERS.some((re) => re.test(html));
  const channelId = extractChannelId(html);
  return channelId || isBuilderSite ? { channelId, isBuilderSite } : null;
}

/** 22900 -> 229. Null for anything not a positive amount. */
function toMajorUnits(amount: number | null | undefined, digits: number): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((amount / 10 ** digits) * 100) / 100;
}

function priceOf(variants: HostingerVariant[]): { price: number | null; currency: string | null } {
  let best: number | null = null;
  let currency: string | null = null;
  for (const v of variants) {
    for (const p of v.prices ?? []) {
      const digits =
        typeof p.currency?.decimal_digits === "number" ? p.currency.decimal_digits : 2;
      // sale_amount is the discounted price the storefront charges; amount is
      // the struck-through original.
      const value = toMajorUnits(p.sale_amount ?? p.amount, digits);
      if (value != null && (best == null || value < best)) best = value;
      currency ??= (p.currency_code ?? p.currency?.code ?? null)?.toUpperCase() ?? null;
    }
  }
  return { price: best, currency };
}

function imageOf(p: HostingerProduct): string | null {
  const first = p.images?.[0];
  const fromImages = typeof first === "string" ? first : first?.url ?? null;
  const url = p.thumbnail || fromImages;
  return url && /^https:\/\//.test(url) ? url : null;
}

function toCategories(p: HostingerProduct): string[] {
  // Collections come back as objects on some stores and bare ids on others;
  // only titled ones are a category a shopper would recognise.
  const names = (p.product_collections ?? [])
    .map((c) =>
      c && typeof c === "object" && "title" in c ? String((c as { title: unknown }).title ?? "") : ""
    )
    .map((t) => decodeEntities(t).trim())
    .filter(Boolean)
    .filter((t) => t.length <= 40);
  return Array.from(new Set(names)).slice(0, 10);
}

/** Exported for tests. */
export function normalize(p: HostingerProduct, domain: string): {
  item: NormalizedProduct | null;
  currency: string | null;
} {
  const id = p.id ?? null;
  const title = decodeEntities(p.title ?? "").trim();
  const slug = p.seo_settings?.slug || p.slug || p.url_handle;
  if (!id || !title || !slug) return { item: null, currency: null };

  const variants = p.variants ?? [];
  const { price, currency } = priceOf(variants);

  // Built by us from the slug, then pinned to the registered host — the same
  // guard as the Woo permalink, so a crafted slug cannot leave the shop.
  const productUrl = sameHostUrl(
    `https://${domain}/${encodeURIComponent(slug)}`,
    domain
  );
  if (!productUrl) return { item: null, currency };

  const tracked = variants.filter((v) => v.manage_inventory && typeof v.inventory_quantity === "number");
  const stockOk =
    tracked.length === 0 || tracked.some((v) => (v.inventory_quantity ?? 0) > 0);

  return {
    item: {
      externalId: id,
      title: title.slice(0, 300),
      description: stripHtml(p.description) ?? stripHtml(p.subtitle),
      price,
      imageUrl: imageOf(p),
      productUrl,
      sku: variants.find((v) => v.sku)?.sku?.trim() || null,
      inStock: p.is_available !== false && p.purchasable !== false && stockOk,
      categories: toCategories(p),
    },
    currency,
  };
}

export async function fetchHostingerCatalog(domain: string): Promise<StoreCatalog> {
  const store = await findStore(domain);
  if (!store?.channelId) {
    throw new FeedError(
      store?.isBuilderSite
        ? "Tai Hostinger svetainė, bet joje nerasta el. parduotuvės. Ar parduotuvė įjungta ir paskelbta?"
        : "Nepavyko rasti Hostinger parduotuvės šiame adrese."
    );
  }

  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();
  let currency = "EUR";
  let total = Infinity;

  for (let page = 0; page < MAX_PAGES && page * PAGE_SIZE < total; page++) {
    const { body } = await getJson(
      `${API_BASE}/${store.channelId}/products` +
        `?offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&exclude_types=subscription`
    );
    const data = body as HostingerPage;
    const batch = data?.products;
    if (!Array.isArray(batch)) {
      throw new FeedError(
        "Hostinger atsakyme nerasta „products“ lauko. Gali būti, kad pasikeitė jų API."
      );
    }
    if (typeof data.count === "number") total = data.count;
    if (batch.length === 0) break;

    for (const raw of batch) {
      const { item, currency: c } = normalize(raw, domain);
      if (c) currency = c;
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

export const hostingerAdapter: FeedAdapter = {
  platform: "hostinger",
  label: "Hostinger",
  fetchCatalog: fetchHostingerCatalog,
  async probe(domain) {
    try {
      return Boolean((await findStore(domain))?.channelId);
    } catch {
      return false;
    }
  },
};
