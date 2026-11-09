/**
 * Cookie consent, our own (replaces CookieYes).
 *
 * One first-party cookie holds the choice. It is read on the server (root
 * layout) so a returning visitor's choice is in force before any tag loads,
 * and on the client for the banner and the analytics switches.
 *
 * Categories:
 *   - necessary: sign-in session, this cookie, signup context. Always on, not
 *     asked: the site does not work without them.
 *   - analytics: PostHog (in code) and Microsoft Clarity (a GTM tag that must
 *     require analytics_storage consent in GTM).
 *   - marketing: no advertising tags exist yet, so the banner does not ask and
 *     it is always false. Add the switch back (and bump CONSENT_VERSION) the
 *     day an ad tag goes into GTM.
 *
 * Bump CONSENT_VERSION when a new tool or purpose is added: everyone is asked
 * again, because an old "yes" did not cover it.
 */

export const CONSENT_COOKIE = "nr_consent";
export const CONSENT_VERSION = 1;
/** Ask again after a year, whatever the answer was. */
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 365;

export const CONSENT_CHANGED_EVENT = "nr:consent-changed";
export const OPEN_CONSENT_EVENT = "nr:open-consent";

export type Consent = {
  analytics: boolean;
  marketing: boolean;
  /** When it was given, unix seconds. */
  at: number;
};

/** "v1.a1.m0.1793900000" — readable in devtools, trivial to parse. */
export function serializeConsent(c: Consent): string {
  return `v${CONSENT_VERSION}.a${c.analytics ? 1 : 0}.m${c.marketing ? 1 : 0}.${c.at}`;
}

/** Null for no choice yet, an older version, or anything malformed. */
export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  const m = /^v(\d+)\.a([01])\.m([01])\.(\d+)$/.exec(raw.trim());
  if (!m) return null;
  if (Number(m[1]) !== CONSENT_VERSION) return null;
  return { analytics: m[2] === "1", marketing: m[3] === "1", at: Number(m[4]) };
}

export function readConsentClient(): Consent | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(hit ? decodeURIComponent(hit.slice(CONSENT_COOKIE.length + 1)) : null);
}

/** Google Consent Mode v2 values for a choice (null = nothing chosen yet). */
export function consentModeSignals(c: Consent | null) {
  const a = c?.analytics ? "granted" : "denied";
  const m = c?.marketing ? "granted" : "denied";
  return {
    analytics_storage: a,
    ad_storage: m,
    ad_user_data: m,
    ad_personalization: m,
  } as const;
}

/**
 * Inline script for the root layout, placed BEFORE Google Tag Manager: sets
 * Consent Mode defaults to denied, then applies a choice already made.
 */
export function consentDefaultsScript(c: Consent | null): string {
  const denied = consentModeSignals(null);
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    `gtag('consent','default',${JSON.stringify({
      ...denied,
      functionality_storage: "granted",
      security_storage: "granted",
      wait_for_update: 500,
    })});`,
    c ? `gtag('consent','update',${JSON.stringify(consentModeSignals(c))});` : "",
  ].join("");
}

type Gtag = (...args: unknown[]) => void;

/** Store a choice and tell everything listening (analytics, GTM, banner). */
export function saveConsent(choice: { analytics: boolean; marketing: boolean }): Consent {
  const c: Consent = { ...choice, at: Math.floor(Date.now() / 1000) };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(c))}; ` +
    `Max-Age=${CONSENT_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag };
  w.dataLayer = w.dataLayer || [];
  const gtag: Gtag =
    w.gtag ??
    function () {
      // Consent Mode reads the arguments object, not an array copy.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  gtag("consent", "update", consentModeSignals(c));
  w.dataLayer.push({ event: "nr_consent_update", ...consentModeSignals(c) });

  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_CHANGED_EVENT, { detail: c }));
  return c;
}

/** For "Slapukų nustatymai" links anywhere on the site. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
