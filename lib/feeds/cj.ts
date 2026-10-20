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
 *                      advertiser we have joined (listed live; see
 *                      listJoinedFeeds).
 *   CJ_COUNTRY_TLD     Optional, default "lt": keep only products whose shop
 *                      link is on this TLD. Advertisers such as Notino publish a
 *                      feed per country under one advertiser ID.
 *
 * The API is GraphQL at https://ads.api.cj.com/query with a Bearer token, and
 * every query takes our companyId. Verified against the live API (2026-10-20):
 *   - `products` pages with offset only up to 10,000 (400 beyond), so we page
 *     with its `nextPage` cursor instead, which has no such cap;
 *   - availability, categories, gender and item groups live on the `Shopping`
 *     type, hence the inline fragment;
 *   - `shoppingProductFeeds` lists every feed on the network, joined or not, so
 *     it cannot tell us what we joined; `products(partnerStatus: JOINED)` can.
 * `pnpm cj:inspect` prints the joined advertisers and a sample mapped row.
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
  brand?: string | null;
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
};

/**
 * Per-advertiser curation overrides, keyed by CJ advertiser ID, merged over
 * the run's config like TradeDoubler's profiles. Empty until the real feeds
 * have been looked at with `pnpm cj:inspect`.
 */
export const CJ_CURATION: Record<string, Partial<CurationConfig>> = {};

/** Notino's giftable corner, by Google category: fragrance, gift sets, candles,
 *  hair and grooming devices, tools. Everyday refills (shampoo, deodorant, lip
 *  balm, toothpaste) are 2/3 of its 59k products and would bury the rest. */
const NOTINO_GIFTS =
  /Perfume & Cologne|Cosmetic Sets|Candles|Hair Styling Tools|Hair Clippers|Electric Razors|Epilators|Makeup Tools|Toothbrushes/;

/**
 * How each joined shop shows on Noriuto:
 *   name   CJ's advertiser names are programme names ("JDsports Europe").
 *   brand  Single-brand shops leave `brand` empty on many rows, which
 *          curation's requireBrand would drop.
 *   keep   Optional filter on the mapped product, for shops whose catalogue is
 *          mostly not gifts.
 *   hold   Joined but not imported in the all-joined run, with the reason.
 *          Listing the ID in CJ_ADVERTISER_IDS still imports it.
 * Unknown advertisers fall back to CJ's own name and the feed's brand.
 */
export const CJ_MERCHANTS: Record<
  string,
  { name: string; brand?: string; keep?: (p: NormalizedProduct) => boolean; hold?: string }
> = {
  "5835258": {
    name: "Notino.lt",
    keep: (p) => {
      const google = p.categoryName ?? "";
      if (NOTINO_GIFTS.test(google.split(" > ").slice(0, 6).join(" > "))) return true;
      // Face skincare (not masks, cleansers, balms) only from €30: serums and
      // creams people give, not the €8 everyday tube.
      return /> Skin Care($| > (?!Skin Care Masks|Lip Balms|Facial Cleansers|Makeup Removers|Tanning))/.test(google) && (p.price ?? 0) >= 30;
    },
  },
  "5896095": {
    name: "Bonami.lt",
    hold: "57k products, mostly household (cleaning, laundry); wait for merchant tiers (T7)",
  },
  "6728089": { name: "Sizeer.lt" },
  "7120612": { name: "JD Sports LT", hold: "same Nike/adidas catalogue as Sizeer; wait for merchant tiers (T7)" },
  "7341377": { name: "Zepter LT", brand: "Zepter" },
  "7336769": { name: "Philips LT", brand: "Philips" },
  "7469933": { name: "Electrolux LT", brand: "Electrolux" },
};

const str = (v: unknown) => JSON.stringify(String(v));

/** One page of products for one advertiser; `page` is the previous page's
 *  `nextPage` cursor. Literal arguments, so there are no variable types to get
 *  wrong (ID vs String). */
export function productsQuery(
  companyId: string,
  advertiserId: string,
  websiteId: string,
  page: string | null,
  limit = CJ_PAGE_SIZE
): string {
  const cursor = page ? `, page: ${str(page)}` : "";
  return `{
  products(companyId: ${str(companyId)}, partnerIds: [${str(advertiserId)}], limit: ${limit}${cursor}) {
    totalCount
    count
    nextPage
    resultList {
      id
      advertiserId
      advertiserName
      title
      brand
      link
      imageLink
      price { amount currency }
      salePrice { amount currency }
      ... on Shopping {
        availability
        productType
        googleProductCategory { name }
        gender
        itemGroupId
      }
      linkCode(pid: ${str(websiteId)}) { clickUrl }
    }
  }
}`;
}

/** One joined product from an advertiser not yet in `exclude`, plus how many
 *  joined products are left outside it. */
export function joinedQuery(companyId: string, exclude: string[]): string {
  return `{
  products(companyId: ${str(companyId)}, partnerStatus: JOINED, excludePartnerIds: [${exclude.map(str).join(", ")}], limit: 1) {
    totalCount
    resultList { advertiserId advertiserName }
  }
}`;
}

/** How many products one advertiser has (all countries). */
export function countQuery(companyId: string, advertiserId: string): string {
  return `{ products(companyId: ${str(companyId)}, partnerIds: [${str(advertiserId)}], limit: 1) { totalCount } }`;
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

/**
 * Every advertiser we have joined that has products. CJ has no "list my
 * programmes" call that is scoped to us, so ask for one joined product outside
 * the advertisers found so far, until none is left.
 */
export async function listJoinedFeeds(token: string, companyId: string): Promise<CjFeedInfo[]> {
  const found: CjFeedInfo[] = [];
  for (let i = 0; i < 200; i++) {
    const data = await cjGraphql<{
      products?: { totalCount?: number; resultList?: { advertiserId?: string | number; advertiserName?: string }[] };
    }>(token, joinedQuery(companyId, found.map((f) => f.advertiserId)));
    const hit = data.products?.resultList?.[0];
    if (!hit?.advertiserId) return found;
    const advertiserId = String(hit.advertiserId);
    const count = await cjGraphql<{ products?: { totalCount?: number } }>(token, countQuery(companyId, advertiserId));
    found.push({
      advertiserId,
      advertiserName: hit.advertiserName?.trim() || advertiserId,
      productCount: Number(count.products?.totalCount ?? 0),
    });
  }
  throw new Error("CJ: more than 200 joined advertisers, refusing to guess");
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

  // Google's category is English and always well-formed ("Health & Beauty >
  // Personal Care > Cosmetics"); the shop's own productType is often in
  // Lithuanian (Bonami, Electrolux) but sometimes Czech (Notino) or carries
  // HTML (Zepter). Keep both: the classifiers match either language.
  const shopType = (Array.isArray(p.productType) ? p.productType[0] : p.productType)
    ?.replace(/<[^>]*>?/g, "")
    .replace(/&[a-z]+;/g, "")
    .trim();
  const categoryName =
    [p.googleProductCategory?.name?.trim(), shopType].filter(Boolean).join(" > ") || null;
  const profile = CJ_MERCHANTS[advertiserId];
  const merchantName = profile?.name || p.advertiserName?.trim() || `CJ ${advertiserId}`;

  // Google-style feeds: "in stock", "in_stock", "out of stock", "preorder".
  const availability = (p.availability ?? "").toLowerCase();
  const inStock = availability === "" || /^(in[ _]?stock|available|preorder|backorder)$/.test(availability);

  const g = (p.gender ?? "").toLowerCase();
  const gender =
    g === "female" || g === "male" || g === "unisex"
      ? (g as "female" | "male" | "unisex")
      : classifyGender(categoryName, productName);

  const product: NormalizedProduct = {
    network: "cj",
    id: `cj-${advertiserId}-${sourceId}`,
    merchantId: advertiserId,
    merchantName,
    productName,
    brandName: p.brand?.trim() || profile?.brand || null,
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
  return !profile?.keep || profile.keep(product) ? product : null;
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
  let page: string | null = null;
  let total = 0;
  let fetched = 0;
  const seen = new Set<string>();
  do {
    const data: {
      products?: { totalCount?: number; nextPage?: string | null; resultList?: CjProduct[] };
    } = await cjGraphql(e.token, productsQuery(e.companyId, advertiserId, e.websiteId, page));
    const rows = data.products?.resultList ?? [];
    total = Number(data.products?.totalCount ?? 0);
    for (const p of rows) yield JSON.stringify(p) + "\n";
    fetched += rows.length;
    const next = data.products?.nextPage || null;
    // A cursor we have already followed would loop forever.
    if (next && seen.has(next)) throw new Error(`CJ advertiser ${advertiserId}: paging cursor repeated`);
    if (next) seen.add(next);
    page = rows.length ? next : null;
    if (fetched % 10_000 < CJ_PAGE_SIZE) log(`  cj ${advertiserId}: ${fetched}/${total}`);
    // Be a polite client: CJ rate-limits per token.
    await new Promise((r) => setTimeout(r, 250));
  } while (page);
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
          const joined = await listJoinedFeeds(e.token, e.companyId);
          const feeds = joined.filter((f) => !CJ_MERCHANTS[f.advertiserId]?.hold);
          log(`  cj: importing ${feeds.map((f) => f.advertiserName).join(", ")}`);
          for (const f of joined) {
            const hold = CJ_MERCHANTS[f.advertiserId]?.hold;
            if (hold) log(`  cj: holding ${f.advertiserName}: ${hold}`);
          }
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
