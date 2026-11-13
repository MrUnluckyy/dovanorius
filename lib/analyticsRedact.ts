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

/** The text with the value of every secret URL parameter replaced. */
export function redactSecrets(text: string): string {
  return text.replace(SECRET_PARAM_VALUE, "$1redacted");
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
