/**
 * What search engines get from discover pages: which pages are worth
 * indexing, a description built from what the page really shows, and the
 * breadcrumb trail.
 */
import type { InspoProduct } from "@/types/inspo";
import { absoluteUrl } from "@/lib/siteUrl";
import type { RecipientKey } from "./recipients";
import { CATEGORY_SLUGS, RECIPIENT_SLUGS, discoverHref, isCategoryFor } from "./routes";

/** Below this, a page is too thin to deserve a place in the index. */
export const MIN_INDEXABLE_PRODUCTS = 8;

/**
 * Index a recipient or category page only when it is a real gift page with
 * real products. "Sau" is personal; pairs a recipient doesn't offer
 * (/idejos/vaikui/irankiai) exist as URLs but are not pages anyone searches.
 */
export function isIndexable(
  recipient: RecipientKey,
  category: string | null,
  productCount: number
): boolean {
  if (recipient === "self") return false;
  if (category && !isCategoryFor(recipient, category)) return false;
  return productCount >= MIN_INDEXABLE_PRODUCTS;
}

/** Every recipient and category page we want in the sitemap. */
export function indexablePaths(): { recipient: RecipientKey; category: string | null }[] {
  const recipients = (Object.keys(RECIPIENT_SLUGS) as RecipientKey[]).filter((r) => r !== "self");
  return recipients.flatMap((recipient) => [
    { recipient, category: null },
    ...Object.keys(CATEGORY_SLUGS)
      .filter((c) => isCategoryFor(recipient, c))
      .map((category) => ({ recipient, category })),
  ]);
}

/** The first few distinct brands, in page order: "Dyson, LEGO, Philips". */
export function topBrands(products: InspoProduct[], n = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    const b = p.brand_name?.trim();
    if (!b || seen.has(b.toLowerCase())) continue;
    seen.add(b.toLowerCase());
    out.push(b);
    if (out.length === n) break;
  }
  return out;
}

export function minPrice(products: InspoProduct[]): number | null {
  const prices = products.map((p) => Number(p.price)).filter((x) => Number.isFinite(x) && x > 0);
  return prices.length ? Math.floor(Math.min(...prices)) : null;
}

/** schema.org BreadcrumbList: Dovanų idėjos › Dovanos moteriai › Grožio dovanos moteriai. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export { discoverHref };
