import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/** Schema.org (partial) types */
type Brand = string | { name?: string };
type PriceSpecification = {
  price?: string | number;
  priceCurrency?: string;
};

type Offer = {
  "@type"?: string | string[];
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
  priceCurrency?: string;
  priceSpecification?: PriceSpecification | PriceSpecification[];
  availability?: string; // usually a URL like "http://schema.org/InStock"
};

type Product = {
  "@type"?: string | string[];
  name?: string;
  sku?: string;
  mpn?: string;
  gtin?: string | number;
  gtin13?: string | number;
  gtin14?: string | number;
  gtin12?: string | number;
  gtin8?: string | number;
  brand?: Brand;
  image?: unknown;
  offers?: Offer | Offer[];
};

// Checked only in <title> — avoids false positives from CDN scripts in page body
const titleBlockMarkers = [
  "attention required",
  "cloudflare",
  "are you a robot",
  "ar jūs ne robotas",
  "captcha",
  "just a moment",
  "backend fetch failed",
];

// These are serious enough to check anywhere in the (small) HTML body,
// but only when the page is suspiciously small (likely a challenge page)
const CHALLENGE_PAGE_MAX_BYTES = 50_000;

// Shops block obvious bot user-agents (velonova sits behind Cloudflare, Pigu
// behind its own WAF). A real browser UA plus the Accept headers a browser
// actually sends gets through the naive filters; the rest need a headless
// browser, which this route deliberately is not.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

/** Utilities */
function abs(u: string | undefined, base: string): string | undefined {
  try {
    return u ? new URL(u, base).toString() : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

// Shops use Product, but also ProductGroup (Shopify variants) and the
// vertical subtypes (Vehicle, Book, IndividualProduct…). Anything that
// carries `offers` and a `name` is close enough to price.
function isProductLike(node: unknown): node is Product {
  if (!isRecord(node)) return false;
  const t = node["@type"];
  const types = typeof t === "string" ? [t] : Array.isArray(t) ? t : [];
  const named = types.some(
    (x) => typeof x === "string" && /product/i.test(x)
  );
  if (named) return true;
  // Untyped or oddly-typed node that still walks like a product
  return typeof node.name === "string" && "offers" in node;
}

function toStringArray(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "string") {
      out.push(x);
      return;
    }
    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }
    // ImageObject / { url } / { contentUrl }
    if (isRecord(x)) {
      walk(x.url ?? x.contentUrl);
    }
  };
  walk(v);
  return out;
}

/**
 * JSON.parse, but tolerant of the malformed JSON-LD shops actually ship.
 *
 * OpenCart/PrestaShop themes interpolate the product description straight into
 * the <script> block, so a description with real newlines in it produces
 * `"description": "line one<LF>line two"` — invalid JSON (unescaped control
 * character), and the whole Product node is lost. velonova.lt does exactly
 * this, which is why its price never came through.
 */
function parseJsonLdLoose(raw: string): unknown {
  const cleaned = raw
    // Some themes wrap the payload in HTML or CDATA comments
    .replace(/^\s*<!--/, "")
    .replace(/-->\s*$/, "")
    .replace(/^\s*\/\/\s*<!\[CDATA\[/, "")
    .replace(/\/\/\s*\]\]>\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to repair
  }

  // Escape control characters that appear INSIDE string literals. Tracking
  // string state matters: the newlines between properties are legal, only the
  // ones inside quotes are not.
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (const ch of cleaned) {
    if (escaped) {
      repaired += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      repaired += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      repaired += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") repaired += "\\n";
      else if (ch === "\r") repaired += "\\r";
      else if (ch === "\t") repaired += "\\t";
      else if (ch < " ") repaired += " ";
      else repaired += ch;
      continue;
    }
    repaired += ch;
  }

  // Trailing commas before a closing brace/bracket are the other common sin
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

  try {
    return JSON.parse(repaired);
  } catch {
    return undefined;
  }
}

/**
 * Walk the whole JSON-LD tree for Product nodes.
 *
 * The old version only looked at the top level and one level of `@graph`, so a
 * product nested under `ItemPage.mainEntity` or inside a nested `@graph` was
 * invisible. Depth is capped so a cyclic or pathological payload can't hang.
 */
function extractProductsFromJsonLd(data: unknown): Product[] {
  const direct: Product[] = [];
  // Products that only appear inside a listing (`ItemList.itemListElement`,
  // related-product carousels). A category page like /dviraciai/plento is one
  // big ItemList, and pulling its first entry would label the category with
  // some random bike's price — so these only count when nothing else matched
  // AND the list holds exactly one product.
  const listed: Product[] = [];
  const seen = new Set<unknown>();

  // Listing containers and editorial cross-links: never a page's own product
  const DEFERRED_KEYS =
    /^(itemListElement|isSimilarTo|isRelatedTo|isAccessoryOrSparePartFor|hasPart|relatedLink|breadcrumb)$/i;
  // Nodes that describe something *about* the product, not the product
  const SKIP_KEYS = /^(review|reviews|aggregateRating|author|publisher|potentialAction)$/i;

  const walk = (node: unknown, depth: number, bucket: Product[]) => {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, bucket);
      return;
    }

    if (isProductLike(node)) bucket.push(node as Product);

    for (const [key, value] of Object.entries(node)) {
      if (!value || typeof value !== "object") continue;
      if (SKIP_KEYS.test(key)) continue;
      walk(value, depth + 1, DEFERRED_KEYS.test(key) ? listed : bucket);
    }
  };

  walk(data, 0, direct);

  if (direct.length) return direct;
  return listed.length === 1 ? listed : [];
}

/** Pick the offer that actually carries a price. */
function pickOffer(offers: Offer | Offer[] | undefined): Offer | undefined {
  if (!offers) return undefined;
  const list = Array.isArray(offers) ? offers : [offers];
  const priced = list.find(
    (o) =>
      isRecord(o) &&
      (o.price !== undefined ||
        o.lowPrice !== undefined ||
        firstPriceSpec(o)?.price !== undefined)
  );
  return priced ?? list.find(isRecord);
}

function firstPriceSpec(o: Offer | undefined): PriceSpecification | undefined {
  const spec = o?.priceSpecification;
  if (Array.isArray(spec)) return spec.find(isRecord);
  return isRecord(spec) ? spec : undefined;
}

/**
 * Normalise whatever the page calls a price into a plain "1234.56" string.
 *
 * Shops write it every way there is: "2 429,50 €", "€2,429.50", "1.234,56",
 * "nuo 39,99". Doing this server-side means the clients can just call
 * Number() instead of each guessing at separators.
 */
function normalizePrice(input: string | number | undefined): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === "number") {
    return Number.isFinite(input) ? String(input) : undefined;
  }

  // Strip currency symbols, letters, NBSP and thin spaces
  const cleaned = input
    .replace(/[   ]/g, " ")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present — whichever comes last is the decimal separator
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    normalized = cleaned
      .split(thousandsSep)
      .join("")
      .replace(decimalSep, ".");
  } else if (lastComma !== -1) {
    const decimals = cleaned.length - lastComma - 1;
    // "1,234" is a thousands separator; "12,99" is a decimal one
    normalized =
      decimals === 3 && cleaned.replace(/[^\d]/g, "").length > 3
        ? cleaned.split(",").join("")
        : cleaned.replace(",", ".");
  } else if (lastDot !== -1) {
    const decimals = cleaned.length - lastDot - 1;
    normalized =
      decimals === 3 && cleaned.replace(/[^\d]/g, "").length > 3
        ? cleaned.split(".").join("")
        : cleaned;
  } else {
    normalized = cleaned;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Trim float noise (19.989999999) without forcing trailing zeros
  return String(Math.round(n * 100) / 100);
}

function cleanCurrency(c: string | undefined): string | undefined {
  if (!c) return undefined;
  const t = c.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(t)) return t;
  const symbols: Record<string, string> = {
    "€": "EUR",
    $: "USD",
    "£": "GBP",
    "₽": "RUB",
    "zł": "PLN",
  };
  return symbols[c.trim()] ?? undefined;
}

/** Decode the body honouring the page's charset, not just UTF-8. */
function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const bytes = new Uint8Array(buf);
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];

  // Sniff <meta charset> from the head when the header doesn't say
  let charset = fromHeader;
  if (!charset) {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
    charset =
      head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
      head.match(/charset=["']?([\w-]+)/i)?.[1];
  }

  const label = (charset ?? "utf-8").toLowerCase();
  if (label === "utf-8" || label === "utf8") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

type FetchResult = {
  html: string;
  finalUrl: string;
  status: number;
};

async function fetchPage(url: string, timeoutMs: number): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: BROWSER_HEADERS,
    });
    const buf = await res.arrayBuffer();
    return {
      html: decodeBody(buf, res.headers.get("content-type")),
      finalUrl: res.url || url,
      status: res.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Swap www. on/off — some shops 403 the bare host but serve the www one. */
function altHostUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.startsWith("www.")
      ? u.hostname.slice(4)
      : `www.${u.hostname}`;
    return u.toString();
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target)
    return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let normalizedTarget = target.trim();
  if (!/^https?:\/\//i.test(normalizedTarget)) {
    normalizedTarget = `https://${normalizedTarget}`;
  }
  try {
    new URL(normalizedTarget);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  console.log(`[parser] ── START ── ${normalizedTarget}`);

  let page: FetchResult;
  try {
    page = await fetchPage(normalizedTarget, 12_000);
    console.log(
      `[parser] fetch ok — status=${page.status} finalUrl=${page.finalUrl} htmlLength=${page.html.length}`
    );
  } catch (e) {
    console.error(`[parser] fetch failed — ${normalizedTarget}`, e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  // A 403/404 on the bare host is often just a misconfigured redirect; try the
  // other side of the www split once before giving up.
  if (page.status >= 400) {
    const alt = altHostUrl(normalizedTarget);
    if (alt) {
      try {
        const retry = await fetchPage(alt, 10_000);
        console.log(
          `[parser] retry ${alt} — status=${retry.status} htmlLength=${retry.html.length}`
        );
        if (retry.status < 400) page = retry;
      } catch (e) {
        console.warn(`[parser] retry failed — ${alt}`, e);
      }
    }
  }

  const { html, finalUrl, status: httpStatus } = page;

  // A dead product page still returns a full themed body (Shopify 404s run to
  // hundreds of KB), and its og: tags describe the STORE, not the product — so
  // parsing on regardless yields an item titled after the shop with the shop
  // logo as its image. Trust the status code instead.
  if (httpStatus >= 400) {
    console.warn(`[parser] UPSTREAM ${httpStatus} — refusing to parse error page`);
    return NextResponse.json(
      {
        error: "PAGE_NOT_AVAILABLE",
        message:
          "That page is no longer available. Check the link, or enter the product details manually.",
      },
      { status: 422 }
    );
  }

  const $ = cheerio.load(html);

  // Scope to the document head: inline SVG icons (Shopify's payment badges,
  // for one) also carry <title> elements, and a bare $("title") can pick up
  // "American Express" instead of the page title.
  const titleTag = $("head > title").first().text().trim();
  console.log(`[parser] <title> = "${titleTag}"`);

  const titleLower = titleTag.toLowerCase();
  const isSmallPage = html.length < CHALLENGE_PAGE_MAX_BYTES;
  const htmlLower = isSmallPage ? html.toLowerCase() : "";

  const blockedBy = titleBlockMarkers.find(
    (m) => titleLower.includes(m) || (isSmallPage && htmlLower.includes(m))
  );

  if (blockedBy) {
    console.warn(`[parser] BLOCKED — matched marker: "${blockedBy}" (titleMatch=${titleLower.includes(blockedBy)}, smallPage=${isSmallPage})`);
    return NextResponse.json(
      {
        error: "SCRAPER_BLOCKED",
        message:
          "Website blocked automated access. Please enter the product details manually.",
      },
      { status: 422 }
    );
  }

  const og = (p: string): string | undefined =>
    $(`meta[property="og:${p}"]`).attr("content") ?? undefined;
  const tw = (n: string): string | undefined =>
    $(`meta[name="twitter:${n}"]`).attr("content") ?? undefined;
  const meta = (n: string): string | undefined =>
    $(`meta[name="${n}"]`).attr("content") ?? undefined;
  const prop = (p: string): string | undefined =>
    $(`meta[property="${p}"]`).attr("content") ??
    $(`meta[name="${p}"]`).attr("content") ??
    undefined;

  // Log all OG tags found
  const ogTags: Record<string, string> = {};
  $("meta[property^='og:']").each((_, el) => {
    const p = $(el).attr("property") ?? "";
    ogTags[p] = $(el).attr("content") ?? "";
  });
  console.log(`[parser] og tags (${Object.keys(ogTags).length}):`, ogTags);

  const siteName = og("site_name") || new URL(finalUrl).hostname;

  // "3T Strada … | Charcoal | Velonova ®" → drop the shop's own suffix when we
  // had to fall back to <title>. og:title is already clean on most shops.
  const stripSiteSuffix = (t: string): string => {
    const brandish = siteName.replace(/^www\./, "").split(".")[0];
    if (!brandish || brandish.length < 3) return t;
    // Split on the LAST separator only, so "3T Strada | Charcoal | Velonova ®"
    // keeps the variant and drops just the shop.
    const m = t.match(/^(.*)\s[|\u2013\u2014\u00b7-]\s([^|\u2013\u2014\u00b7]*)$/);
    if (!m || !m[1].trim()) return t;
    const escaped = brandish.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "i").test(m[2]) ? m[1].trim() : t;
  };

  const rawTitle = og("title") || meta("title") || tw("title") || undefined;
  const title = rawTitle || (titleTag ? stripSiteSuffix(titleTag) : undefined);

  const descriptionRaw =
    og("description") || meta("description") || tw("description") || undefined;
  const description = descriptionRaw?.slice(0, 500);

  console.log(`[parser] resolved title = "${title}"`);

  const images = [
    og("image"),
    og("image:secure_url"),
    tw("image"),
    $('link[rel="image_src"]').attr("href") ?? undefined,
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  const favicons = [
    $('link[rel="icon"]').attr("href") ?? undefined,
    $('link[rel="shortcut icon"]').attr("href") ?? undefined,
    "/favicon.ico",
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  let mergedProduct: Product | undefined;
  let blocksSeen = 0;
  let blocksRepaired = 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    blocksSeen += 1;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = parseJsonLdLoose(raw);
      if (data !== undefined) {
        blocksRepaired += 1;
        console.log(`[parser] JSON-LD: repaired a malformed block`);
      } else {
        console.warn(`[parser] JSON-LD: unrecoverable block, skipping`);
        return;
      }
    }

    for (const p of extractProductsFromJsonLd(data)) {
      // Merge field-by-field keeping the first non-empty value: a plain spread
      // lets a later, sparser node blank out fields the first one filled.
      const base: Record<string, unknown> = { ...(mergedProduct ?? {}) };
      for (const [k, v] of Object.entries(p)) {
        const empty =
          base[k] === undefined ||
          base[k] === null ||
          base[k] === "" ||
          (Array.isArray(base[k]) && (base[k] as unknown[]).length === 0);
        if (empty && v !== undefined && v !== null && v !== "") base[k] = v;
      }
      mergedProduct = base as Product;
    }
  });

  console.log(
    `[parser] JSON-LD blocks=${blocksSeen} repaired=${blocksRepaired} product=${!!mergedProduct}`
  );

  let price: string | undefined;
  let priceCurrency: string | undefined;
  let availability: string | undefined;
  let brand: string | undefined;
  let sku: string | undefined;
  let gtin: string | number | undefined;
  let mpn: string | undefined;
  let productImages: string[] = [];

  if (mergedProduct) {
    const offer = pickOffer(mergedProduct.offers);
    const spec = firstPriceSpec(offer);

    price = normalizePrice(offer?.price ?? spec?.price ?? offer?.lowPrice);
    priceCurrency = cleanCurrency(offer?.priceCurrency ?? spec?.priceCurrency);

    availability =
      typeof offer?.availability === "string"
        ? offer.availability.split("/").pop()
        : undefined;

    brand =
      typeof mergedProduct.brand === "string"
        ? mergedProduct.brand
        : isRecord(mergedProduct.brand)
          ? (mergedProduct.brand.name as string | undefined)
          : undefined;

    sku = mergedProduct.sku;
    gtin =
      mergedProduct.gtin ??
      mergedProduct.gtin13 ??
      mergedProduct.gtin14 ??
      mergedProduct.gtin12 ??
      mergedProduct.gtin8;
    mpn = mergedProduct.mpn;

    productImages = toStringArray(mergedProduct.image)
      .map((u) => abs(u, finalUrl))
      .filter((u): u is string => typeof u === "string");

    console.log(
      `[parser] JSON-LD → price=${price} currency=${priceCurrency} brand=${brand} images=${productImages.length}`
    );
  }

  // ── Fallback 1: product:/og: price meta ───────────────────────────────────
  // velonova and most OpenCart/WooCommerce themes emit these even when their
  // JSON-LD is broken.
  if (!price) {
    price = normalizePrice(
      prop("product:price:amount") ??
        prop("og:price:amount") ??
        prop("product:sale_price:amount") ??
        prop("twitter:data1")
    );
    if (price) console.log(`[parser] price from meta tags → ${price}`);
  }
  if (!priceCurrency) {
    priceCurrency = cleanCurrency(
      prop("product:price:currency") ??
        prop("og:price:currency") ??
        prop("product:sale_price:currency")
    );
  }

  // ── Fallback 2: schema.org microdata ──────────────────────────────────────
  const itemprop = (name: string): string | undefined => {
    const el = $(`[itemprop="${name}"]`).first();
    if (!el.length) return undefined;
    const attr =
      el.attr("content") ??
      el.attr("value") ??
      el.attr("href") ??
      el.attr("src");
    const text = el.text().trim();
    return attr || text || undefined;
  };

  if (!price) {
    price = normalizePrice(itemprop("price"));
    if (price) console.log(`[parser] price from microdata → ${price}`);
  }
  if (!priceCurrency) priceCurrency = cleanCurrency(itemprop("priceCurrency"));
  if (!availability) {
    const a = itemprop("availability");
    availability = a ? a.split("/").pop() : undefined;
  }
  if (!brand) brand = itemprop("brand");
  if (!sku) sku = itemprop("sku");
  if (!mpn) mpn = itemprop("mpn");
  if (!productImages.length) {
    const mi = abs(itemprop("image"), finalUrl);
    if (mi) productImages = [mi];
  }

  // Currency of last resort: infer from the symbol next to the price, else the
  // TLD. A price with no currency is close to useless to the buyer.
  if (price && !priceCurrency) {
    const near =
      $('[itemprop="price"]').parent().text() ||
      prop("product:price:amount") ||
      "";
    priceCurrency =
      cleanCurrency(near.match(/[€$£]/)?.[0]) ??
      (/\.(lt|lv|ee|de|fr|es|it|fi|ie|nl|be|at|pt|sk|si|gr)$/i.test(
        new URL(finalUrl).hostname
      )
        ? "EUR"
        : undefined);
  }

  const uniqueImages = Array.from(new Set([...productImages, ...images]));

  const result = {
    url: finalUrl,
    siteName,
    title,
    description,
    images: uniqueImages,
    favicon: favicons.find((u) => !!u),
    price,
    currency: priceCurrency,
    availability,
    brand,
    sku,
    gtin,
    mpn,
  };

  console.log(`[parser] ── RESULT ──`, {
    title: result.title,
    price: result.price,
    currency: result.currency,
    brand: result.brand,
    imageCount: result.images.length,
    hasDescription: !!result.description,
  });

  return NextResponse.json(result);
}
