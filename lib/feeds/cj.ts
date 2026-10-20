/**
 * CJ (Commission Junction) product-feed adapter.
 *
 * Configure via env:
 *   CJ_ACCESS_TOKEN    Personal Access Token from developers.cj.com
 *                      (Authentication > Personal Access Tokens).
 *   CJ_COMPANY_ID      Our publisher company ID (CID, 7 digits:
 *                      members.cj.com > Account > Account information).
 *   CJ_WEBSITE_ID      Our website / property ID (PID). Product links are
 *                      generated for it, which is what makes clicks ours.
 *   CJ_ADVERTISER_IDS  Optional comma-separated advertiser IDs. Empty = every
 *                      advertiser we have joined that publishes a product feed
 *                      (listed live with shoppingProductFeeds).
 *   CJ_COUNTRY_TLD     Optional, default "lt": keep only products whose shop
 *                      link is on this TLD. Advertisers such as Notino publish a
 *                      feed per country under one advertiser ID.
 *
 * The API is GraphQL at https://ads.api.cj.com/query with a Bearer token, and
 * every query takes our companyId. Field names below follow CJ's Product Feed
 * reference; `pnpm cj:inspect` prints the live schema and a sample mapped row,
 * so the first run with a real token confirms them. All of CJ's naming lives
 * in QUERY and mapProduct(), nowhere else.
 *
 * Never a partial catalogue: the importer prunes products missing from a
 * merchant's feed, so if CJ hands back fewer rows than its own totalCount (a
 * paging cap, a failed page) the download fails rather than letting the prune
 * delete the rest.
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { classifyGender, classifyProductType, classifySeason } from "./classify";
import type { CurationConfig } from "./curate";
import type { FeedAdapter, FeedSource, NormalizedProduct } from "./types";

export const CJ_API = "https://ads.api.cj.com/query";
/** CJ's per-request cap. */
export const CJ_PAGE_SIZE = 1000;

/** What we read from one CJ product (only the parts we consume). */
export type CjProduct = {
  id?: string;
  advertiserId?: string | number;
  advertiserName?: string;
  title?: string;
  brand?: string;
  link?: string;
  imageLink?: string;
  availability?: string;
  price?: { amount?: string | number; currency?: string } | null;
  salePrice?: { amount?: string | number; currency?: string } | null;
  productType?: string | string[] | null;
  googleProductCategory?: { name?: string } | null;
  gender?: string | null;
  itemGroupId?: string | null;
  linkCode?: { clickUrl?: string } | null;
};

export type CjFeedInfo = {
  advertiserId: string;
  advertiserName: string;
  productCount: number;
  advertiserCountry?: string | null;
  language?: string | null;
  currency?: string | null;
};

/**
 * Per-advertiser curation overrides, keyed by CJ advertiser ID, merged over
 * the run's config like TradeDoubler's profiles. Empty until the real feeds
 * have been looked at with `pnpm cj:inspect`.
 */
export const CJ_CURATION: Record<string, Partial<CurationConfig>> = {};

const str = (v: unknown) => JSON.stringify(String(v));

/** One page of products for one advertiser. Literal arguments, so there are no
 *  variable types to get wrong (ID vs String) before the schema is confirmed. */
export function productsQuery(
  companyId: string,
  advertiserId: string,
  websiteId: string,
  offset: number,
  limit = CJ_PAGE_SIZE
): string {
  return `{
  products(companyId: ${str(companyId)}, partnerIds: [${str(advertiserId)}], limit: ${limit}, offset: ${offset}) {
    totalCount
    count
    resultList {
      id
      advertiserId
      advertiserName
      title
      brand
      link
      imageLink
      availability
      price { amount currency }
      salePrice { amount currency }
      productType
      googleProductCategory { name }
      gender
      itemGroupId
      linkCode(pid: ${str(websiteId)}) { clickUrl }
    }
  }
}`;
}

export function feedsQuery(companyId: string): string {
  return `{
  shoppingProductFeeds(companyId: ${str(companyId)}) {
    totalCount
    resultList {
      advertiserId
      advertiserName
      productCount
      advertiserCountry
      language
      currency
    }
  }
}`;
}

type Env = { token: string; companyId: string; websiteId: string; tld: string };

function env(): Env {
  const token = process.env.CJ_ACCESS_TOKEN?.trim();
  const companyId = process.env.CJ_COMPANY_ID?.trim();
  const websiteId = process.env.CJ_WEBSITE_ID?.trim();
  if (!token) throw new Error("CJ_ACCESS_TOKEN is not set");
  if (!companyId) throw new Error("CJ_COMPANY_ID is not set");
  if (!websiteId) throw new Error("CJ_WEBSITE_ID is not set");
  return { token, companyId, websiteId, tld: (process.env.CJ_COUNTRY_TLD ?? "lt").trim().toLowerCase() };
}

/** POST one GraphQL query, retrying rate limits and server errors. */
export async function cjGraphql<T>(token: string, query: string): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(CJ_API, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (res.status === 429 || res.status >= 500) {
      await res.text();
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message?: string }[] } | null;
    if (!res.ok || !body || body.errors?.length) {
      const msg = body?.errors?.map((e) => e.message).join("; ") || `${res.status} ${res.statusText}`;
      throw new Error(`CJ API: ${msg}`);
    }
    return body.data as T;
  }
  throw new Error("CJ API: still rate limited after 4 attempts");
}

/** Every joined advertiser that publishes a product feed. */
export async function listJoinedFeeds(token: string, companyId: string): Promise<CjFeedInfo[]> {
  const data = await cjGraphql<{ shoppingProductFeeds?: { resultList?: Record<string, unknown>[] } }>(
    token,
    feedsQuery(companyId)
  );
  const byAdvertiser = new Map<string, CjFeedInfo>();
  for (const f of data.shoppingProductFeeds?.resultList ?? []) {
    const id = String(f.advertiserId ?? "");
    if (!id) continue;
    const prev = byAdvertiser.get(id);
    const count = Number(f.productCount ?? 0);
    byAdvertiser.set(id, {
      advertiserId: id,
      advertiserName: String(f.advertiserName ?? id),
      productCount: (prev?.productCount ?? 0) + (Number.isFinite(count) ? count : 0),
      advertiserCountry: (f.advertiserCountry as string) ?? null,
      language: (f.language as string) ?? null,
      currency: (f.currency as string) ?? null,
    });
  }
  return [...byAdvertiser.values()];
}

const money = (m: CjProduct["price"]) => {
  const n = Number.parseFloat(String(m?.amount ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CJ product -> our shape, or null to skip. Skips products with no tracked
 * click URL (an untracked link earns nothing and we never import one), no
 * price, or a shop link outside the country TLD.
 */
export function mapProduct(p: CjProduct, tld: string): NormalizedProduct | null {
  const productName = (p.title ?? "").trim();
  const advertiserId = p.advertiserId != null ? String(p.advertiserId) : "";
  const sourceId = (p.id ?? "").trim();
  const deepLink = p.linkCode?.clickUrl?.trim();
  const shopLink = p.link?.trim() ?? "";
  if (!productName || !advertiserId || !sourceId || !deepLink) return null;

  const host = hostOf(shopLink);
  if (tld && (!host || !(host === tld || host.endsWith(`.${tld}`)))) return null;

  const listed = money(p.price);
  const sale = money(p.salePrice);
  if (listed == null && sale == null) return null;
  // A live sale price below the listed one is what the shopper pays; the listed
  // price becomes the "was".
  const onSale = sale != null && listed != null && sale < listed;
  const price = onSale ? sale! : (listed ?? sale!);
  const rrp = onSale ? listed : null;

  const categoryName =
    (Array.isArray(p.productType) ? p.productType[0] : p.productType)?.trim() ||
    p.googleProductCategory?.name?.trim() ||
    null;
  const merchantName = p.advertiserName?.trim() || `CJ ${advertiserId}`;

  // Google-style feeds: "in stock", "in_stock", "out of stock", "preorder".
  const availability = (p.availability ?? "").toLowerCase();
  const inStock = availability === "" || /^(in[ _]?stock|available|preorder|backorder)$/.test(availability);

  const g = (p.gender ?? "").toLowerCase();
  const gender =
    g === "female" || g === "male" || g === "unisex"
      ? (g as "female" | "male" | "unisex")
      : classifyGender(categoryName, productName);

  return {
    network: "cj",
    id: `cj-${advertiserId}-${sourceId}`,
    merchantId: advertiserId,
    merchantName,
    productName,
    brandName: p.brand?.trim() || null,
    categoryName,
    price,
    rrp,
    currency: p.price?.currency || p.salePrice?.currency || "EUR",
    imageUrl: p.imageLink?.trim() || null,
    deepLink,
    inStock,
    gender,
    season: classifySeason(productName),
    productType: classifyProductType(categoryName, merchantName, productName),
    // Google feeds group sizes/colours under item_group_id: collapse on it.
    conceptKey: p.itemGroupId?.trim() ? `${advertiserId}:${p.itemGroupId.trim()}` : null,
  };
}

/**
 * Page through one advertiser's products as newline-delimited JSON. Throws if
 * the pages do not add up to CJ's own totalCount, so a capped or broken
 * download can never reach the prune step as if it were the whole catalogue.
 */
export async function* fetchAdvertiser(
  e: Env,
  advertiserId: string,
  log: (m: string) => void = () => {}
): AsyncGenerator<string> {
  let offset = 0;
  let total = Infinity;
  let fetched = 0;
  while (offset < total) {
    const data = await cjGraphql<{
      products?: { totalCount?: number; count?: number; resultList?: CjProduct[] };
    }>(e.token, productsQuery(e.companyId, advertiserId, e.websiteId, offset));
    const page = data.products?.resultList ?? [];
    total = Number(data.products?.totalCount ?? page.length);
    if (page.length === 0) break;
    for (const p of page) yield JSON.stringify(p) + "\n";
    fetched += page.length;
    offset += page.length;
    if (fetched % 10_000 < CJ_PAGE_SIZE) log(`  cj ${advertiserId}: ${fetched}/${total}`);
    // Be a polite client: CJ rate-limits per token.
    await new Promise((r) => setTimeout(r, 250));
  }
  if (fetched < total) {
    throw new Error(
      `CJ returned ${fetched} of ${total} products for advertiser ${advertiserId}; ` +
        `refusing a partial feed (the prune would delete the rest)`
    );
  }
}

/** Stream-parse the NDJSON that fetchAdvertiser produced. */
export async function* parseCjFeed(body: Readable, tld: string): AsyncIterable<NormalizedProduct> {
  const rl = createInterface({ input: body, crlfDelay: Infinity });
  let failure: Error | null = null;
  body.on("error", (err) => {
    failure = err instanceof Error ? err : new Error(String(err));
    rl.close();
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let raw: CjProduct;
    try {
      raw = JSON.parse(line) as CjProduct;
    } catch {
      continue;
    }
    const product = mapProduct(raw, tld);
    if (product) yield product;
  }
  if (failure) throw failure;
}

function source(e: Env, advertiserId: string, label: string): FeedSource {
  return {
    label: `cj:${label} (${advertiserId})`,
    url: CJ_API,
    compression: "none",
    curate: CJ_CURATION[advertiserId],
    download: async (log) => Readable.from(fetchAdvertiser(e, advertiserId, log)),
    parse: (body) => parseCjFeed(body, e.tld),
  };
}

export const cjAdapter: FeedAdapter = {
  network: "cj",

  listFeeds(): FeedSource[] {
    const e = env();
    const ids = (process.env.CJ_ADVERTISER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) return ids.map((id) => source(e, id, id));

    // No list configured: one source that resolves our joined feeds when it
    // downloads, then pages each advertiser in turn. Prune stays scoped to the
    // merchants actually staged, so a programme leaving CJ is never wiped by
    // this run, only no longer refreshed.
    return [
      {
        label: "cj:all joined advertisers",
        url: CJ_API,
        compression: "none",
        download: async (log) => {
          const feeds = await listJoinedFeeds(e.token, e.companyId);
          log(`  cj: ${feeds.length} joined advertiser(s): ${feeds.map((f) => f.advertiserName).join(", ")}`);
          async function* all() {
            for (const f of feeds) yield* fetchAdvertiser(e, f.advertiserId, log);
          }
          return Readable.from(all());
        },
        parse: (body) => parseCjFeed(body, e.tld),
      },
    ];
  },

  async *parse(body: Readable): AsyncIterable<NormalizedProduct> {
    yield* parseCjFeed(body, env().tld);
  },
};
