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

/**
 * A stored wish URL as an absolute http(s) shop URL, or null when it is not a
 * usable link.
 *
 * The web forms add "https://" through ItemSchema, but other clients (the
 * mobile app, the share extension) have stored "www.shop.lt/...", bare
 * domains, relative paths ("/product.html") and free text. Those made /out
 * answer {"error":"Invalid url"} to whoever opened the wish.
 */
export function normalizeShopUrl(raw: string | null | undefined): string | null {
  const value = unwrapOwnOut((raw ?? "").trim()).url.trim();
  if (!value) return null;

  let candidate = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Scheme-less: accept only something that starts like a hostname with a
    // short TLD, so free text such as "Galima.pirkti.Akropolyje" is not
    // turned into a link to a host that does not exist.
    if (!/^[^\s/?#]+\.[a-z]{2,6}(?:[:/?#]|$)/i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * A board wish's shop link: through /out, so the click is logged and tracked.
 * Null when the stored URL is not a usable link; show it as text instead.
 */
export function wishOutHref(item: { id: string; url: string }): string | null {
  const shopUrl = normalizeShopUrl(item.url);
  if (!shopUrl) return null;
  return `/out?u=${encodeURIComponent(shopUrl)}&item=${encodeURIComponent(item.id)}`;
}
