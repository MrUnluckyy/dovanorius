import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/** Schema.org (partial) types */
type Brand = string | { name?: string };
type PriceSpecification = {
  price?: string | number;
  priceCurrency?: string;
};

type Offer = {
  price?: string | number;
  priceCurrency?: string;
  priceSpecification?: PriceSpecification;
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
  image?: string | string[];
  offers?: Offer | Offer[];
};

type JsonLdNode = Record<string, unknown>;
type MaybeGraph = JsonLdNode & { "@graph"?: unknown };

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

function isProductLike(node: unknown): node is Product {
  if (!isRecord(node)) return false;
  const t = node["@type"];
  if (typeof t === "string") return t === "Product";
  if (Array.isArray(t)) return t.includes("Product");
  return false;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  return typeof v === "string" ? [v] : [];
}

/** Safely gather Product nodes from any JSON-LD block */
function extractProductsFromJsonLd(data: unknown): Product[] {
  const out: Product[] = [];
  const pushIfProduct = (n: unknown) => {
    if (isProductLike(n)) out.push(n);
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      if (isProductLike(item)) pushIfProduct(item);
      if (isRecord(item) && Array.isArray((item as MaybeGraph)["@graph"])) {
        for (const g of (item as MaybeGraph)["@graph"] as unknown[]) {
          pushIfProduct(g);
        }
      }
    }
    return out;
  }

  if (isRecord(data)) {
    if (isProductLike(data)) pushIfProduct(data);
    const g = (data as MaybeGraph)["@graph"];
    if (Array.isArray(g)) {
      for (const n of g) pushIfProduct(n);
    }
  }

  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target)
    return NextResponse.json({ error: "Missing url" }, { status: 400 });

  console.log(`[parser] ── START ── ${target}`);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);

  let html = "";
  let finalUrl = target;
  let httpStatus = 0;

  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Metadata Bot)" },
    });
    finalUrl = res.url || target;
    httpStatus = res.status;
    html = await res.text();
    console.log(`[parser] fetch ok — status=${httpStatus} finalUrl=${finalUrl} htmlLength=${html.length}`);
  } catch (e) {
    clearTimeout(timeout);
    console.error(`[parser] fetch failed — ${target}`, e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
  clearTimeout(timeout);

  const $ = cheerio.load(html);

  const titleTag = $("title").first().text().trim();
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

  // Log all OG tags found
  const ogTags: Record<string, string> = {};
  $("meta[property^='og:']").each((_, el) => {
    const prop = $(el).attr("property") ?? "";
    const content = $(el).attr("content") ?? "";
    ogTags[prop] = content;
  });
  console.log(`[parser] og tags (${Object.keys(ogTags).length}):`, ogTags);

  // Log key meta tags
  console.log(`[parser] meta description = "${meta("description")}"`);
  console.log(`[parser] twitter:image = "${tw("image")}"`);

  const title =
    og("title") ||
    titleTag ||
    meta("title") ||
    undefined;
  const descriptionRaw =
    og("description") || meta("description") || tw("description") || undefined;
  const description = descriptionRaw?.slice(0, 500);

  console.log(`[parser] resolved title = "${title}"`);
  console.log(`[parser] resolved description = "${description?.slice(0, 80)}…"`);

  const images = [
    og("image"),
    og("image:secure_url"),
    tw("image"),
    $('link[rel="image_src"]').attr("href") ?? undefined,
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  console.log(`[parser] og/twitter images (${images.length}):`, images);

  const favicons = [
    $('link[rel="icon"]').attr("href") ?? undefined,
    $('link[rel="shortcut icon"]').attr("href") ?? undefined,
    "/favicon.ico",
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  const siteName = og("site_name") || new URL(finalUrl).hostname;

  // JSON-LD
  let mergedProduct: Product | undefined;
  const jsonLdBlocks: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const data: unknown = JSON.parse(raw);
      jsonLdBlocks.push(data);
      const products = extractProductsFromJsonLd(data);
      if (products.length) {
        console.log(`[parser] JSON-LD: found ${products.length} Product node(s)`);
      }
      for (const p of products) {
        mergedProduct = { ...(mergedProduct ?? {}), ...p };
      }
    } catch (e) {
      console.warn(`[parser] JSON-LD parse error:`, e);
    }
  });

  console.log(`[parser] JSON-LD blocks found: ${jsonLdBlocks.length}, product extracted: ${!!mergedProduct}`);
  if (mergedProduct) {
    console.log(`[parser] JSON-LD product:`, JSON.stringify(mergedProduct, null, 2));
  }

  let price: string | number | undefined;
  let priceCurrency: string | undefined;
  let availability: string | undefined;
  let brand: string | undefined;
  let sku: string | undefined;
  let gtin: string | number | undefined;
  let mpn: string | undefined;
  let productImages: string[] = [];

  if (mergedProduct) {
    const offers = Array.isArray(mergedProduct.offers)
      ? mergedProduct.offers[0]
      : mergedProduct.offers;

    price = offers?.price ?? offers?.priceSpecification?.price;
    priceCurrency =
      offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;

    availability =
      typeof offers?.availability === "string"
        ? offers.availability.split("/").pop()
        : undefined;

    brand =
      typeof mergedProduct.brand === "string"
        ? mergedProduct.brand
        : mergedProduct.brand?.name;

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

    console.log(`[parser] offers → price=${price} currency=${priceCurrency} availability=${availability}`);
    console.log(`[parser] product images from JSON-LD (${productImages.length}):`, productImages);
  }

  const uniqueImages = Array.from(
    new Set([...(productImages ?? []), ...images])
  );

  const result = {
    url: finalUrl,
    siteName,
    title,
    description,
    images: uniqueImages,
    favicon: favicons.find((u) => !!u),
    price: typeof price !== "undefined" ? String(price) : undefined,
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
    imageCount: result.images.length,
    hasDescription: !!result.description,
  });

  return NextResponse.json(result);
}
