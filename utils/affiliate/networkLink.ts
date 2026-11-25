/**
 * Discover's affiliate products already carry the network's tracked link
 * (from the feed). /out now takes those too, so the click is logged and our
 * sub id rides along — the key the network reports back with each sale
 * (Awin clickref, TradeDoubler epi, CJ sid), which ties a sale on the admin
 * Pajamos page to the product that earned it.
 *
 * Only the networks' own tracking hosts are accepted: /out must not become an
 * open redirect.
 */

export type Network = "awin" | "tradedoubler" | "cj";

const CJ_HOSTS = /^(www\.)?(anrdoezrs\.net|tkqlhce\.com|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com)$/i;

export function networkOf(url: string): Network | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "www.awin1.com" || host === "awin1.com") return "awin";
  if (host === "pdt.tradedoubler.com" || host === "clk.tradedoubler.com") return "tradedoubler";
  if (CJ_HOSTS.test(host)) return "cj";
  return null;
}

/** The tracked link with our sub id added the way each network expects. */
export function tagNetworkLink(url: string, subId: string): string | null {
  const network = networkOf(url);
  if (!network) return null;
  if (network === "awin" || network === "cj") {
    const u = new URL(url);
    u.searchParams.set(network === "awin" ? "clickref" : "sid", subId);
    return u.toString();
  }
  // TradeDoubler's parser is order-sensitive: url(...) must stay LAST, so
  // epi(...) goes in front of it (replacing any existing epi).
  const withoutEpi = url.replace(/epi\([^)]*\)/i, "");
  const at = withoutEpi.search(/url\(/i);
  if (at < 0) return null;
  return `${withoutEpi.slice(0, at)}epi(${subId})${withoutEpi.slice(at)}`;
}

/**
 * The programme id inside a tracked link, to find our affiliate_merchants row:
 * Awin `m=117711`, TradeDoubler `p(380227)`. CJ links name a link id, not the
 * advertiser, so for CJ the shop is found from the embedded `url=` instead.
 */
export function advertiserOf(url: string): { network: Network; advertiserId: string | null; targetUrl: string | null } | null {
  const network = networkOf(url);
  if (!network) return null;
  const u = new URL(url);
  if (network === "awin") {
    return { network, advertiserId: u.searchParams.get("m") ?? u.searchParams.get("awinmid"), targetUrl: u.searchParams.get("ued") };
  }
  if (network === "tradedoubler") {
    const p = /p\((\d+)\)/i.exec(url)?.[1] ?? null;
    const inner = /url\((.*)\)\s*$/i.exec(url)?.[1];
    let target: string | null = null;
    try {
      target = inner ? decodeURIComponent(inner) : null;
    } catch {
      target = null;
    }
    return { network, advertiserId: p, targetUrl: target };
  }
  return { network, advertiserId: null, targetUrl: u.searchParams.get("url") };
}
