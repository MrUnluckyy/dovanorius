// Client-safe: no Supabase import, so product cards can use it.

/**
 * Discover links partner products through /out, so the click is logged and the
 * shop's URL gets tagged (see utils/affiliate/partnerLink.ts). Affiliate rows
 * already carry a tracked network deeplink and keep linking straight to it.
 */
export function shopHref(product: { id: string; deepLink: string }): string {
  if (!product.id.startsWith("partner:")) return product.deepLink;
  return `/out?u=${encodeURIComponent(product.deepLink)}&p=${encodeURIComponent(product.id)}`;
}
