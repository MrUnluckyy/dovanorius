export type AffiliateNetwork = "awin" | "tradedoubler" | "sovrn" | "direct";

export type AffiliateMerchant = {
  id: string;
  name: string;
  /** Hostnames this merchant owns, e.g. ["zara.com", "www.zara.com"]. */
  domains: string[];
  network: AffiliateNetwork;
  /** Advertiser/program id within the network (e.g. Awin `awinmid`). */
  network_advertiser_id: string | null;
  /**
   * Deeplink template with placeholders substituted at click time:
   * {URL} {RAW_URL} {ADVERTISER_ID} {PUBLISHER_ID} {SUB_ID} {SOVRN_KEY}.
   */
  deeplink_template: string | null;
  commission_rate: number | null;
  is_allowlisted: boolean;
  quality_tier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AffiliateClick = {
  id: string;
  item_id: string | null;
  user_id: string | null;
  merchant_id: string | null;
  target_url: string;
  sub_id: string | null;
  created_at: string;
};

/** Per-network publisher credentials, read from env at request time. */
export type AffiliateCredentials = {
  awinPublisherId?: string;
  tradedoublerAffiliateId?: string;
  sovrnKey?: string;
};
