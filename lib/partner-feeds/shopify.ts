/**
 * Reads a Shopify storefront's public catalogue.
 *
 * Every Shopify store exposes /products.json (paginated, 250 max per page) and
 * /meta.json without authentication. We only ever take a bare domain from the
 * partner and build these URLs ourselves — see the migration for why.
 */
import { FeedError, type FeedAdapter, type NormalizedProduct, type StoreCatalog } from "./types";
import { getJson, stripHtml } from "./http";

const PAGE_SIZE = 250;
/** Safety valve: 40 pages = 10k products. Guards against a pathological store. */
const MAX_PAGES = 40;

/** Store currency lives in /meta.json; products.json has no currency at all. */
async function fetchCurrency(domain: string): Promise<string> {
  try {
    const { body } = await getJson(`https://${domain}/meta.json`);
    const meta = body as { currency?: string };
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

export async function fetchShopifyCatalog(domain: string): Promise<StoreCatalog> {
  const currency = await fetchCurrency(domain);

  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { body } = await getJson(
      `https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`
    );
    const data = body as { products?: ShopifyProduct[] };

    const batch = data?.products;
    if (!Array.isArray(batch)) {
      throw new FeedError(
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
    throw new FeedError("Parduotuvėje nerasta produktų.");
  }

  return { currency, products };
}

export const shopifyAdapter: FeedAdapter = {
  platform: "shopify",
  label: "Shopify",
  fetchCatalog: fetchShopifyCatalog,
  async probe(domain) {
    try {
      const { body } = await getJson(`https://${domain}/products.json?limit=1`);
      return Array.isArray((body as { products?: unknown[] })?.products);
    } catch {
      return false;
    }
  },
};
