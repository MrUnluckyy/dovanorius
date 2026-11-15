/**
 * URL handling for the product parser: clean pasted links, refuse addresses
 * that are not a public shop, and turn a URL into a readable fallback title.
 */

/**
 * Click-tracking parameters that never identify a product. An allowlist of
 * junk, not a blanket query strip: pigu's ?id= and similar ARE the product.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^(gclid|gbraid|wbraid|gad_source|gad_campaignid|dclid|msclkid|fbclid|igshid|srsltid|_gl|mc_cid|mc_eid|yclid|ttclid|twclid|li_fat_id|epik|cq_[a-z]+|trac|ref_?)$/i,
];

/** The link without tracking parameters (and without an empty "?"). */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
    }
    u.hash = u.hash.startsWith("#size") ? "" : u.hash;
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

/**
 * True only for a public internet hostname. The parser fetches whatever it is
 * given, so without this it is a door into our own network: localhost, the
 * cloud metadata address, private ranges, single-label names.
 */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host.length > 253) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (/\.(local|internal|lan|home|corp|intranet)$/.test(host)) return false;
  // Any IP literal is refused: shops have names. Covers 127/8, 10/8,
  // 169.254.169.254, ::1, fc00::/7 and friends without listing them.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  const labels = host.split(".");
  if (labels.length < 2) return false;
  return /^[a-z]{2,24}$|^xn--[a-z0-9-]{2,59}$/.test(labels[labels.length - 1]);
}

/** "www.senukai.lt" → "senukai.lt". */
export function shopHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/**
 * A readable title from the URL, for when the page itself can't be read:
 * "/p/elektrine-mesmale-zyle-zy358mg-2000-w/d9f1" → "Elektrine mesmale zyle
 * zy358mg 2000 w". Slugs lose their diacritics, so the person is asked to
 * check it, but it beats an empty field. Null when nothing word-like is left.
 */
export function titleFromUrl(url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const segments = path
    .split("/")
    .map((s) => s.replace(/\.(html?|php|aspx?)$/i, ""))
    .filter(Boolean);

  // The most word-like segment: most hyphen/underscore-separated letter words.
  const words = (s: string) => s.split(/[-_+\s]+/).filter((w) => /[a-zà-ž]{2,}/i.test(w));
  const best = [...segments].sort((a, b) => words(b).length - words(a).length)[0];
  if (!best || words(best).length < 2) return null;

  const tokens = best.split(/[-_+\s]+/).filter(Boolean);
  // Trailing database ids ("…-5906280654696", "…-39875736") are noise.
  while (tokens.length > 2 && /^\d{5,}$/.test(tokens[tokens.length - 1])) tokens.pop();
  // Leading numeric ids ("191742-zaislinis-…") too.
  while (tokens.length > 2 && /^\d{4,}$/.test(tokens[0])) tokens.shift();

  const text = tokens.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 4) return null;
  return text.charAt(0).toUpperCase() + text.slice(1, 120);
}
