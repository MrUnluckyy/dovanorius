/**
 * The one canonical origin for the site.
 *
 * The site is served from `www.noriuto.lt`; the apex 307-redirects there. But
 * `NEXT_PUBLIC_WEB_URL` is set to the apex in production, so canonicals, the
 * sitemap and JSON-LD were all naming a host that redirects — and pages whose
 * canonical points at a redirect give Google a reason to sit on them. Rather
 * than depend on an env var being fixed in Vercel, normalise here: whatever
 * host is configured, emit the `www` form.
 *
 * If the canonical host ever changes, change `CANONICAL_HOST` — nothing else
 * should hardcode an origin.
 */
const CANONICAL_HOST = "www.noriuto.lt";

function canonicalOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL;
  if (!configured) return `https://${CANONICAL_HOST}`;
  try {
    const url = new URL(configured);
    // Anything pointing at our own domain gets the canonical host. Other hosts
    // (preview deployments, localhost) are left alone so they stay self-linking.
    if (url.hostname === CANONICAL_HOST || url.hostname === "noriuto.lt") {
      return `https://${CANONICAL_HOST}`;
    }
    return url.origin;
  } catch {
    return `https://${CANONICAL_HOST}`;
  }
}

/** Origin with no trailing slash, e.g. `https://www.noriuto.lt`. */
export const SITE_URL = canonicalOrigin();

/** Absolute URL for a site-relative path. `absoluteUrl("/blog")`. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
