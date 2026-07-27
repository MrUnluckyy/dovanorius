import type {
  AffiliateCredentials,
  AffiliateMerchant,
  AffiliateNetwork,
} from "@/types/affiliate";

/** Publisher id for a network, from env-sourced credentials. */
function publisherId(
  network: AffiliateNetwork,
  creds: AffiliateCredentials
): string | undefined {
  switch (network) {
    case "awin":
      return creds.awinPublisherId;
    case "tradedoubler":
      return creds.tradedoublerAffiliateId;
    case "sovrn":
      // Sovrn identifies the publisher by key, injected via {SOVRN_KEY}.
      return creds.sovrnKey;
    case "direct":
      return undefined;
  }
}

/**
 * Build a tracked affiliate deeplink for `targetUrl` from the merchant's
 * template. Returns `null` when no usable link can be produced (missing
 * template, or a network that still needs a publisher id) — callers should
 * fall back to the raw `targetUrl` so the click never breaks.
 *
 * Pure and side-effect free: all credentials are passed in, so it is directly
 * unit-testable without env access.
 */
export function buildDeeplink({
  merchant,
  targetUrl,
  subId,
  credentials,
}: {
  merchant: Pick<
    AffiliateMerchant,
    "network" | "network_advertiser_id" | "deeplink_template"
  >;
  targetUrl: string;
  subId?: string;
  credentials: AffiliateCredentials;
}): string | null {
  const template = merchant.deeplink_template?.trim();
  if (!template) return null;

  const pubId = publisherId(merchant.network, credentials);
  // Networks (all but `direct`) can't attribute without a publisher id.
  if (merchant.network !== "direct" && !pubId) return null;

  const substitutions: Record<string, string> = {
    "{URL}": encodeURIComponent(targetUrl),
    "{RAW_URL}": targetUrl,
    "{ADVERTISER_ID}": merchant.network_advertiser_id ?? "",
    "{PUBLISHER_ID}": pubId ?? "",
    "{SUB_ID}": subId ?? "",
    "{SOVRN_KEY}": credentials.sovrnKey ?? "",
  };

  const link = Object.entries(substitutions).reduce(
    (acc, [token, value]) => acc.split(token).join(value),
    template
  );

  // Guard against a template that still references an unfilled placeholder.
  if (/\{[A-Z_]+\}/.test(link)) return null;

  return link;
}
