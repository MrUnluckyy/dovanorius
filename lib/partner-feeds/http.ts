import { FeedError } from "./types";

/**
 * Fetching and text handling shared by every adapter.
 *
 * These were written for the Shopify reader and are unchanged in behaviour —
 * they moved here so a second adapter inherits the same domain validation
 * rather than reimplementing it slightly differently.
 */

export const FETCH_TIMEOUT_MS = 20_000;

/**
 * Accepts what a partner is likely to paste ("https://shop.com/", "shop.com",
 * "www.shop.com") and returns a bare lowercase host. Rejects anything that
 * isn't a plain public hostname.
 */
export function normalizeShopDomain(input: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) throw new FeedError("Nenurodytas parduotuvės adresas.");

  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^[^/@]*@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    throw new FeedError(`Netinkamas domenas: „${input}".`);
  }
  // No internal targets — this host is fetched server-side on a schedule.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    throw new FeedError("Neleistinas domenas.");
  }
  return host;
}

export type JsonResponse = { body: unknown; headers: Headers };

/**
 * GET JSON, returning headers too — WooCommerce reports its page count in
 * x-wp-totalpages and there is no way to read it from the body.
 */
export async function getJson(url: string): Promise<JsonResponse> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "NoriutoBot/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new FeedError(`${url} grąžino ${res.status}.`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    throw new FeedError(
      `${url} grąžino ne JSON (${type || "nenurodyta"}).`
    );
  }
  return { body: await res.json(), headers: res.headers };
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
};

/**
 * Decode HTML entities in shop-supplied text.
 *
 * WooCommerce's Store API returns product and category names HTML-encoded, so
 * half of one shop's titles rendered as "&#8222;Pritaikyk paveikslėlį&#8221;".
 * One pass, so "&amp;#8222;" decodes once to "&#8222;" and no further.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 2000) : null;
}

/**
 * Keep only a product URL that actually belongs to the shop we were told about.
 *
 * Shopify URLs are built by us from the handle, but WooCommerce hands back a
 * `permalink` the shop itself controls — and that string is stored and later
 * rendered as an outbound link for shoppers. Pinning it to the registered host
 * means a misconfigured or hijacked feed cannot turn the partner's catalogue
 * into a redirector.
 */
export function sameHostUrl(candidate: string | null | undefined, domain: string): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const expected = domain.toLowerCase().replace(/^www\./, "");
  return host === expected ? url.toString() : null;
}
