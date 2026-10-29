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

const OWN_OUT = /^https?:\/\/(?:www\.)?noriuto\.lt\/out\?/i;

/**
 * The shop URL inside one of our own /out links, or the URL itself.
 *
 * The app saves a Discover idea with the tracked link it opened —
 * https://www.noriuto.lt/out?u=<shop> — so some wishes store that rather than
 * the shop. Wrapped in /out again it was logged twice, the outer click with no
 * merchant and no way to attribute it. Unwrapped a few levels at most.
 */
export function unwrapOwnOut(url: string): { url: string; productId: string | null } {
  let current = url;
  let productId: string | null = null;
  for (let i = 0; i < 3 && OWN_OUT.test(current); i++) {
    try {
      const params = new URL(current).searchParams;
      const inner = params.get("u");
      if (!inner) break;
      productId = productId ?? params.get("p");
      current = inner;
    } catch {
      break;
    }
  }
  return { url: current, productId };
}

/** A board wish's shop link: through /out, so the click is logged and tracked. */
export function wishOutHref(item: { id: string; url: string }): string {
  return `/out?u=${encodeURIComponent(unwrapOwnOut(item.url).url)}&item=${encodeURIComponent(item.id)}`;
}
