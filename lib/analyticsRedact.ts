/**
 * URL parameters that carry a credential. Emailed auth links bring
 * `token_hash` to /auth/confirm, OAuth brings `code` to the callback, and a
 * recovery link brings the session tokens in the fragment. None of them may
 * reach analytics: whoever reads the event could redeem the link first.
 */
const SECRET_PARAMS = [
  "token_hash",
  "token",
  "code",
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
];

const SECRET_PARAM_VALUE = new RegExp(
  `([?&#](?:${SECRET_PARAMS.join("|")})=)[^&#\\s"']*`,
  "gi"
);

/**
 * Routes where the path itself is the key: whoever has the link can see a
 * shared board, join an event or board, open a guest's event seat, change a
 * reservation, or join a partner team. The legacy English paths still
 * redirect, and the partner host serves its invite at /join.
 */
const CAPABILITY_ROUTES = [
  "b/s",
  "r/keep",
  "r/release",
  "renginiai/prieiga",
  "renginiai/prisijungti",
  "events/join",
  "lentos/prisijungti",
  "boards/join",
  "partner/join",
  "join",
];

// A slash, or its encoded form: the login page carries the invite path in ?next=.
const SLASH = "(?:/|%2F)";

const CAPABILITY_PATH = new RegExp(
  // Only at the start of a path: the start of the text, after a host, or
  // after a quote, a space or "=" (attribute values, query parameters).
  `(^|[\\s"'=(]|${SLASH}{2}[^/\\s"'?#%]+)` +
    `(${SLASH}(?:${CAPABILITY_ROUTES.map((r) => r.replace("/", SLASH)).join("|")})${SLASH})` +
    `[^/?#&\\s"'%]+`,
  "gi"
);

/**
 * The text with the value of every secret URL parameter replaced, and the
 * token in every capability link replaced with "[token]", so pages still
 * group by route.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(SECRET_PARAM_VALUE, "$1redacted")
    .replace(CAPABILITY_PATH, "$1$2[token]");
}

/**
 * A copy of an analytics payload with secrets removed from every string in it.
 * URLs show up in many places: $current_url, $referrer, the session and
 * initial ones in $set_once, and link hrefs in autocapture's $elements_chain.
 */
export function redactPayload<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map(redactPayload) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactPayload(v)])
    ) as T;
  }
  return value;
}
