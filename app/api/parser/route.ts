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

  // Fetch server-side (avoid CORS), follow redirects, short timeout
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);

  let html = "";
  let finalUrl = target;

  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Metadata Bot)" },
    });

    // 1) Upstream HTTP error (e.g. 403/503)
    if (!res.ok) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: 502 }
      );
    }

    finalUrl = res.url || target;
    html = await res.text();

    // 2) CAPTCHA / Bot protection detection
    if (/captcha|are you human|cloudflare/i.test(html)) {
      clearTimeout(timeout);
      return NextResponse.json(
        {
          error:
            "Target site is protecting against bots; metadata unavailable.",
        },
        { status: 409 }
      );
    }
  } catch (e) {
    clearTimeout(timeout);
    console.error("Fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
  clearTimeout(timeout);

  const $ = cheerio.load(html);

  const og = (p: string): string | undefined =>
    $(`meta[property="og:${p}"]`).attr("content") ?? undefined;
  const tw = (n: string): string | undefined =>
    $(`meta[name="twitter:${n}"]`).attr("content") ?? undefined;
  const meta = (n: string): string | undefined =>
    $(`meta[name="${n}"]`).attr("content") ?? undefined;

  // Basic/OG/Twitter
  const title =
    og("title") ||
    $("title").first().text().trim() ||
    meta("title") ||
    undefined;
  const description =
    og("description") || meta("description") || tw("description") || undefined;

  const images = [
    og("image"),
    og("image:secure_url"),
    tw("image"),
    $('link[rel="image_src"]').attr("href") ?? undefined,
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  // Favicon(s)
  const favicons = [
    $('link[rel="icon"]').attr("href") ?? undefined,
    $('link[rel="shortcut icon"]').attr("href") ?? undefined,
    "/favicon.ico",
  ]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((u) => abs(u, finalUrl))
    .filter((u): u is string => typeof u === "string");

  // Site name
  const siteName = og("site_name") || new URL(finalUrl).hostname;

  // Try Schema.org JSON-LD for rich product data
  let mergedProduct: Product | undefined;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text();
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      const products = extractProductsFromJsonLd(data);
      for (const p of products) {
        mergedProduct = { ...(mergedProduct ?? {}), ...p };
      }
    } catch {
      // ignore invalid JSON
    }
  });

  // Extract fields from Product & Offers
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
  }

  const uniqueImages = Array.from(
    new Set([...(productImages ?? []), ...images])
  );

  return NextResponse.json({
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
  });
}
