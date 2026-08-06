/**
 * Reads a Shopify storefront's public catalogue.
 *
 * Every Shopify store exposes /products.json (paginated, 250 max per page) and
 * /meta.json without authentication. We only ever take a bare domain from the
 * partner and build these URLs ourselves — see the migration for why.
 */

const PAGE_SIZE = 250;
/** Safety valve: 40 pages = 10k products. Guards against a pathological store. */
const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 20_000;

export type NormalizedProduct = {
  externalId: string;
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  productUrl: string;
  sku: string | null;
  inStock: boolean;
  /** Shopify tags + product_type, lightly cleaned. Gift metadata stays partner-owned. */
  categories: string[];
};

export type ShopifyCatalog = {
  currency: string;
  products: NormalizedProduct[];
};

export class ShopifyFeedError extends Error {}

/**
 * Accepts what a partner is likely to paste ("https://shop.com/", "shop.com",
 * "www.shop.com") and returns a bare lowercase host. Rejects anything that
 * isn't a plain public hostname.
 */
export function normalizeShopDomain(input: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) throw new ShopifyFeedError("Nenurodytas parduotuvės adresas.");

  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^[^/@]*@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    throw new ShopifyFeedError(`Netinkamas domenas: „${input}".`);
  }
  // No internal targets — this host is fetched server-side on a schedule.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    throw new ShopifyFeedError("Neleistinas domenas.");
  }
  return host;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "NoriutoBot/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new ShopifyFeedError(`${url} grąžino ${res.status}.`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    throw new ShopifyFeedError(
      `${url} grąžino ne JSON (${type || "nenurodyta"}). Ar tai Shopify parduotuvė?`
    );
  }
  return res.json();
}

/** Store currency lives in /meta.json; products.json has no currency at all. */
async function fetchCurrency(domain: string): Promise<string> {
  try {
    const meta = (await getJson(`https://${domain}/meta.json`)) as {
      currency?: string;
    };
    return meta?.currency?.toUpperCase() || "EUR";
  } catch {
    return "EUR";
  }
}

type ShopifyVariant = {
  price?: string;
  sku?: string | null;
  available?: boolean;
};
type ShopifyProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  variants?: ShopifyVariant[];
  images?: { src?: string }[];
};

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 2000) : null;
}

function toCategories(p: ShopifyProduct): string[] {
  const tags = Array.isArray(p.tags)
    ? p.tags
    : typeof p.tags === "string"
    ? p.tags.split(",")
    : [];
  const all = [p.product_type ?? "", ...tags]
    .map((t) => t.trim())
    .filter(Boolean)
    // Shopify's product_type is free text and some stores put a whole sentence
    // in it; anything long is description, not a category.
    .filter((t) => t.length <= 40);
  return Array.from(new Set(all)).slice(0, 10);
}

function normalize(p: ShopifyProduct, domain: string): NormalizedProduct | null {
  const id = p.id != null ? String(p.id) : null;
  const title = (p.title ?? "").trim();
  if (!id || !title || !p.handle) return null;

  const variants = p.variants ?? [];
  const prices = variants
    .map((v) => Number.parseFloat(v.price ?? ""))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    externalId: id,
    title: title.slice(0, 300),
    description: stripHtml(p.body_html),
    // Cheapest variant — matches how the storefront advertises "from €X".
    price: prices.length ? Math.min(...prices) : null,
    imageUrl: p.images?.[0]?.src ?? null,
    productUrl: `https://${domain}/products/${p.handle}`,
    sku: variants.find((v) => v.sku)?.sku ?? null,
    inStock: variants.some((v) => v.available === true),
    categories: toCategories(p),
  };
}

export async function fetchShopifyCatalog(
  rawDomain: string
): Promise<ShopifyCatalog> {
  const domain = normalizeShopDomain(rawDomain);
  const currency = await fetchCurrency(domain);

  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = (await getJson(
      `https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`
    )) as { products?: ShopifyProduct[] };

    const batch = data?.products;
    if (!Array.isArray(batch)) {
      throw new ShopifyFeedError(
        "Atsakyme nerasta „products“ lauko. Ar tai Shopify parduotuvė?"
      );
    }
    if (batch.length === 0) break;

    for (const raw of batch) {
      const item = normalize(raw, domain);
      // Some stores repeat products across pages; keep the first occurrence.
      if (item && !seen.has(item.externalId)) {
        seen.add(item.externalId);
        products.push(item);
      }
    }

    if (batch.length < PAGE_SIZE) break;
  }

  if (products.length === 0) {
    throw new ShopifyFeedError("Parduotuvėje nerasta produktų.");
  }

  return { currency, products };
}
