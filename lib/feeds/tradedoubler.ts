/**
 * TradeDoubler product-feed adapter.
 *
 * Configure via env:
 *   TRADEDOUBLER_PRODUCTS_TOKEN — the PRODUCTS API token (also drives the
 *                    productsUnlimited bulk export; no separate download token).
 *   TRADEDOUBLER_FEED_IDS — optional comma-separated fids. Defaults to the
 *                    profiled feeds below. Every id must have a profile.
 *
 * Two things about this API are not in the published docs and cost hours if
 * rediscovered the hard way:
 *
 * 1. **Matrix parameters.** The bulk endpoint takes `;fid=` in the PATH, not
 *    `?fid=`. With a query param it answers `PF_4001 "fid is required."`, which
 *    reads like a missing argument but is really "wrong call shape".
 * 2. **The export is asynchronous.** The first call answers `202` with
 *    `{"message": "Unlimited file will be created…"}`; the file only exists on a
 *    later call, which then `302`s to a signed CDN URL. So this adapter owns its
 *    own download (`FeedSource.download`) to poll instead of using the core's
 *    plain fetch. TD caps generation at 3 downloads per feed version per 24h, so
 *    the poll interval is deliberately unhurried.
 *
 * The payload is one JSON object per line between a `{"products":[` header and a
 * `]}` footer — streamable line by line, which matters at 674k rows.
 *
 * **Field layout differs per feed**, which is why profiles exist rather than one
 * generic mapper: About You puts brand/size/groupingId at the top level, while
 * Pigu and 4F bury everything in `fields[]` — and Pigu publishes no brand at all
 * (see `brandFromDescription`).
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { classifyGender, classifyProductType, classifySeason } from "./classify";
import type { CurationConfig } from "./curate";
import type { FeedAdapter, FeedSource, NormalizedProduct } from "./types";

const API = "https://api.tradedoubler.com/1.0/productsUnlimited";

/** Raw shapes we read out of the export (only the parts we consume). */
type TdField = { name: string; value?: string };
type TdOffer = {
  productUrl?: string;
  sourceProductId?: string;
  programName?: string;
  priceHistory?: { date?: number; price?: { value?: string; currency?: string } }[];
};
type TdProduct = {
  name?: string;
  description?: string;
  brand?: string;
  size?: string;
  groupingId?: string;
  identifiers?: Record<string, string>;
  fields?: TdField[];
  offers?: TdOffer[];
  /**
   * The bulk export names this field `tdCategoryName`; the search service calls
   * the same thing `name`. Read both — looking only for `name` makes every
   * export row appear to have no category at all.
   */
  categories?: { tdCategoryName?: string; name?: string }[];
  productImage?: { url?: string };
};

type FeedProfile = {
  fid: string;
  label: string;
  /** Programme id — must match affiliate_merchants.network_advertiser_id. */
  merchantId: string;
  merchantName: string;
  /** Where the brand comes from; feeds disagree. */
  brand:
    | { from: "top" }
    | { from: "constant"; value: string }
    | { from: "description" };
  /** `fields[]` entry holding the "was" price, if the feed publishes one. */
  rrpField?: string;
  /**
   * `fields[]` entry holding a CURRENT discounted price that undercuts the one
   * in `priceHistory` — Dyson's `sale_price` works this way (listed €499,
   * sale_price €399, and €399 is what the shopper pays). Taking the offer price
   * at face value would both overprice the row and hide a real discount, so
   * when this is present and lower it becomes the price and the offer price
   * becomes the rrp.
   */
  salePriceField?: string;
  /** `fields[]` entry holding stock state, if the feed publishes one. */
  stockField?: string;
  /**
   * Where the category comes from. The bulk export ships an EMPTY `categories`
   * array on every feed (the search service populates it, the export does not —
   * and no export parameter brings it back), so "url-path" reconstructs it from
   * the merchant's own URL hierarchy instead. Feeds whose product URLs are flat
   * have no category at all.
   */
  categoryFrom?: "url-path";
  /**
   * How to group variants of one product. "url-product-id" pulls the product id
   * out of the deeplink; "name" (default) falls through to the curator's
   * brand+name collapse.
   */
  variantKey?: "url-product-id" | "name";
  /** Per-feed curation overrides, merged over the run's config. */
  curate?: Partial<CurationConfig>;
};

/** Assessed 2026-08-07 against the real exports, one profile per fid. */
export const TD_FEED_PROFILES: Record<string, FeedProfile> = {
  "109344": {
    fid: "109344",
    label: "Dyson LT",
    merchantId: "361723",
    merchantName: "Dyson LT",
    brand: { from: "top" }, // constant "Dyson"
    salePriceField: "sale_price",
    // Only 54 products, but they are the ones people actually put on boards
    // (9 Airwrap listings, 22 hair-care in total). Nothing here fits the €300
    // gift band — the range is €20–€1199 — so this feed carries its own cap
    // rather than being filtered away.
    curate: { requireInStock: false, maxPrice: 1300 },
    // Dyson's URLs are flat (/dyson-cool-tower-fan-white-silver), so there is no
    // category to recover; product_type still resolves "plaukų" → beauty.
  },
  "256919": {
    fid: "256919",
    label: "4F Store LT",
    merchantId: "392834",
    merchantName: "4F LT",
    brand: { from: "top" }, // constant "4F", but the field is populated
    rrpField: "Prevoius_price", // sic — the typo is TradeDoubler's
    // No stock field: presence in the feed is the only availability signal, so
    // sold-outs are reconciled by the nightly prune instead.
    curate: { requireInStock: false },
  },
  "118239": {
    fid: "118239",
    label: "Pigu.lt",
    merchantId: "380227",
    merchantName: "Pigu.lt",
    // `brand_title` exists but is empty on every row sampled; the description is
    // reliably "<brand> <name>" instead.
    brand: { from: "description" },
    rrpField: "price_without_discount",
    stockField: "availability",
    // Pigu's product URLs mirror its on-site taxonomy 3-4 levels deep, which is
    // the only category signal that survives the export.
    categoryFrom: "url-path",
    // A quarter of extracted brands are the placeholder "Nenurodyta", and this
    // is the only non-fashion catalogue we have — requiring a brand would throw
    // away the furniture/home/toys inventory that makes it worth importing.
    curate: { requireBrand: false },
  },
  "259263": {
    fid: "259263",
    label: "About You LT",
    merchantId: "403112",
    merchantName: "About You LT",
    brand: { from: "top" },
    // Neither groupingId (= the EAN, one per size) nor the name (colour is baked
    // into the title) identifies a product concept — the deeplink path does.
    variantKey: "url-product-id",
    curate: {
      requireInStock: false,
      // 674k raw rows (97.6% of them inside the gift band) would swamp a ~149k
      // catalogue. Cap near Modivo's footprint so the two can be compared on
      // engagement before either is cut. NB the cap keeps the first N rows the
      // feed emits, not the best N — raise it rather than relying on the tail
      // being unwanted.
      perMerchantCap: 80_000,
    },
  },
};

const DEFAULT_FIDS = ["109344", "256919", "118239", "259263"];

/** Latest price from the offer's price history (feeds may carry several). */
function latestPrice(offer: TdOffer): { value: number; currency: string } | null {
  const history = offer.priceHistory ?? [];
  let best: { value: number; currency: string } | null = null;
  let bestDate = -Infinity;
  for (const h of history) {
    const v = Number.parseFloat(h.price?.value ?? "");
    if (!Number.isFinite(v)) continue;
    const d = h.date ?? 0;
    if (d >= bestDate) {
      bestDate = d;
      best = { value: v, currency: h.price?.currency ?? "EUR" };
    }
  }
  return best;
}

function fieldMap(p: TdProduct): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of p.fields ?? []) {
    if (f.value != null && f.value !== "") out[f.name] = f.value;
  }
  return out;
}

/**
 * Pigu publishes no brand, but its description is exactly "<brand> <name>" —
 * so the brand is whatever prefixes the title. Returns null for the literal
 * placeholder Pigu uses when the merchant left brand blank.
 */
function brandFromDescription(p: TdProduct): string | null {
  const name = (p.name ?? "").trim();
  const desc = (p.description ?? "").trim();
  if (!name || !desc || !desc.endsWith(name) || desc.length <= name.length) {
    return null;
  }
  const brand = desc.slice(0, desc.length - name.length).trim();
  if (!brand || /^(nenurodyta|kita|n\/a|nera)$/i.test(brand)) return null;
  return brand;
}

/** Unwrap the merchant URL from TD's `url(...)` matrix syntax. */
function targetUrl(productUrl: string): string | null {
  const wrapped = /url\((.*)\)\s*$/.exec(productUrl);
  if (!wrapped) return null;
  try {
    return decodeURIComponent(wrapped[1]);
  } catch {
    return null;
  }
}

/**
 * About You's real product key: /p/<brand>/<slug>-<PRODUCT_ID>?vid=<VARIANT_ID>.
 */
function urlProductId(productUrl: string): string | null {
  const inner = targetUrl(productUrl);
  return inner ? (/\/p\/[^/]+\/[^/?]*?(\d+)\?/.exec(inner)?.[1] ?? null) : null;
}

/**
 * Rebuild the category from the merchant's URL hierarchy, e.g.
 * `pigu.lt/lt/baldai-ir-namu-interjeras/svetaines-baldai/sekcijos/<product>`
 * → "baldai ir namu interjeras > svetaines baldai > sekcijos".
 *
 * The last segment is the product slug, so it is dropped. Gender often lives in
 * these slugs ("marskineliai-moterims"), which is why the result is fed to
 * classifyGender as well as stored.
 */
function categoryFromUrl(productUrl: string): string | null {
  const inner = targetUrl(productUrl);
  if (!inner) return null;
  let path: string[];
  try {
    path = new URL(inner).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
  if (path[0]?.length === 2) path = path.slice(1); // locale prefix (/lt/…)
  const segments = path.slice(0, -1); // drop the product slug
  if (!segments.length) return null;
  return segments.map((s) => s.replace(/-/g, " ")).join(" > ");
}

function mapProduct(p: TdProduct, profile: FeedProfile): NormalizedProduct | null {
  const offer = p.offers?.[0];
  const productName = (p.name ?? "").trim();
  const deepLink = offer?.productUrl?.trim();
  const priced = offer ? latestPrice(offer) : null;
  if (!offer || !productName || !deepLink || !priced) return null;

  const fields = fieldMap(p);

  let brandName: string | null = null;
  if (profile.brand.from === "top") brandName = p.brand?.trim() || null;
  else if (profile.brand.from === "constant") brandName = profile.brand.value;
  else brandName = brandFromDescription(p);

  // A live sale price replaces the offer price, which then becomes the "was".
  const saleRaw = profile.salePriceField
    ? Number.parseFloat(fields[profile.salePriceField] ?? "")
    : NaN;
  const onSale = Number.isFinite(saleRaw) && saleRaw > 0 && saleRaw < priced.value;
  const price = onSale ? saleRaw : priced.value;

  const rrpRaw = profile.rrpField
    ? Number.parseFloat(fields[profile.rrpField] ?? "")
    : NaN;
  const rrp = onSale
    ? priced.value
    : Number.isFinite(rrpRaw) && rrpRaw > price
      ? rrpRaw
      : null;

  // Only Pigu publishes stock. Elsewhere absence means "in the feed, so live" —
  // the profile turns off requireInStock so this default is never load-bearing.
  const stock = profile.stockField ? fields[profile.stockField] : undefined;
  const inStock = stock == null ? true : /^(in_?stock|available|1|true|yes)$/i.test(stock);

  const feedCategory =
    p.categories?.[0]?.tdCategoryName?.trim() || p.categories?.[0]?.name?.trim() || null;
  // Where a profile says so, the merchant's URL hierarchy beats the feed's own
  // category (Pigu publishes one flat top-level bucket, but its URLs run 3-4
  // levels deep and name the audience in the slug).
  const categoryName =
    profile.categoryFrom === "url-path"
      ? (categoryFromUrl(deepLink) ?? feedCategory)
      : feedCategory;
  const sourceId = offer.sourceProductId ?? p.identifiers?.ean ?? null;
  if (!sourceId) return null;

  const conceptKey =
    profile.variantKey === "url-product-id" ? urlProductId(deepLink) : null;

  return {
    network: "tradedoubler",
    id: `td-${profile.fid}-${sourceId}`,
    merchantId: profile.merchantId,
    merchantName: profile.merchantName,
    productName,
    brandName,
    categoryName,
    price,
    rrp,
    currency: priced.currency,
    imageUrl: p.productImage?.url?.trim() || null,
    deepLink,
    inStock,
    // TD category paths name the audience outright ("Moterims - …", "Vyrai > …"),
    // which is a far better gender signal than mining it out of the title.
    gender: classifyGender(categoryName, productName),
    season: classifySeason(productName),
    productType: classifyProductType(categoryName, profile.merchantName, productName),
    conceptKey,
  };
}

/**
 * Ask for the bulk export, waiting out the async generation. Resolves to the
 * response body once TD serves the file rather than the "come back in a bit"
 * placeholder.
 */
async function downloadExport(
  url: string,
  label: string,
  log: (m: string) => void = () => {}
): Promise<Readable> {
  const ATTEMPTS = 40;
  const WAIT_MS = 15_000;

  for (let i = 1; i <= ATTEMPTS; i++) {
    const res = await fetch(url);

    // 202 = queued. The body is a JSON message, not the feed.
    if (res.status === 202) {
      await res.text();
      log(`  ${label}: export queued, waiting (${i}/${ATTEMPTS})`);
      await new Promise((r) => setTimeout(r, WAIT_MS));
      continue;
    }
    if (!res.ok || !res.body) {
      throw new Error(`TD export failed: ${res.status} ${res.statusText}`);
    }
    // A 200 can still carry the placeholder message instead of the file.
    const type = res.headers.get("content-type") ?? "";
    const len = Number(res.headers.get("content-length") ?? "0");
    if (type.includes("application/json") && len > 0 && len < 500) {
      const body = await res.text();
      if (/come back in a bit/i.test(body)) {
        log(`  ${label}: export still generating, waiting (${i}/${ATTEMPTS})`);
        await new Promise((r) => setTimeout(r, WAIT_MS));
        continue;
      }
      throw new Error(`TD export error: ${body.slice(0, 200)}`);
    }
    return Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  }
  throw new Error(`TD export for ${label} did not become ready`);
}

function profilesFromEnv(): FeedProfile[] {
  const configured = (process.env.TRADEDOUBLER_FEED_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fids = configured.length ? configured : DEFAULT_FIDS;

  return fids.map((fid) => {
    const profile = TD_FEED_PROFILES[fid];
    if (!profile) {
      throw new Error(
        `No TradeDoubler feed profile for fid ${fid}. Feeds differ in field ` +
          `layout, so each needs a profile in lib/feeds/tradedoubler.ts ` +
          `(known: ${Object.keys(TD_FEED_PROFILES).join(", ")})`
      );
    }
    return profile;
  });
}

export const tradedoublerAdapter: FeedAdapter = {
  network: "tradedoubler",

  listFeeds(): FeedSource[] {
    const token = process.env.TRADEDOUBLER_PRODUCTS_TOKEN?.trim();
    if (!token) throw new Error("TRADEDOUBLER_PRODUCTS_TOKEN is not set");

    return profilesFromEnv().map((profile) => {
      // Matrix parameter, not a query parameter — see the file header.
      const url = `${API};fid=${profile.fid}?token=${encodeURIComponent(token)}`;
      return {
        label: `tradedoubler:${profile.label} (fid=${profile.fid})`,
        url,
        compression: "none",
        curate: profile.curate,
        download: (log) => downloadExport(url, profile.label, log),
        parse: (body) => parseFeed(body, profile),
      };
    });
  },

  async *parse(body: Readable): AsyncIterable<NormalizedProduct> {
    // Every TD feed needs its profile to be mapped at all, so the per-feed
    // `FeedSource.parse` above is the real entry point. This exists only to
    // satisfy the adapter contract.
    void body;
    throw new Error(
      "tradedoubler: use FeedSource.parse — mapping is per-feed, not per-network"
    );
  },
};

/** Stream the line-delimited export, mapping each row through `profile`. */
export async function* parseFeed(
  body: Readable,
  profile: FeedProfile
): AsyncIterable<NormalizedProduct> {
  const rl = createInterface({ input: body, crlfDelay: Infinity });

  // readline ends quietly when its source errors, which would make a truncated
  // download look like a complete feed — and a complete feed is what the prune
  // step deletes against. Capture the error and rethrow once the loop drains.
  let failure: Error | null = null;
  body.on("error", (err) => {
    failure = err instanceof Error ? err : new Error(String(err));
    rl.close();
  });

  for await (const line of rl) {
    // Strip the `{"products":[` header, the `]}` footer and per-row commas.
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed.startsWith("{") || trimmed === '{"products":[') continue;

    let raw: TdProduct;
    try {
      raw = JSON.parse(trimmed) as TdProduct;
    } catch {
      continue; // a single malformed row must not abort a 674k-row feed
    }
    const product = mapProduct(raw, profile);
    if (product) yield product;
  }

  if (failure) throw failure;
}
