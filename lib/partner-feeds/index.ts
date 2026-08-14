import { FeedError, type FeedAdapter, type FeedPlatform, type StoreCatalog } from "./types";
import { shopifyAdapter } from "./shopify";
import { wooCommerceAdapter } from "./woocommerce";

export { FeedError } from "./types";
export type { FeedPlatform, NormalizedProduct, StoreCatalog } from "./types";
export { normalizeShopDomain } from "./http";

/**
 * Every storefront platform we can read.
 *
 * Adding one means writing an adapter and appending it here. Nothing else —
 * the sync, the partner panel and the nightly job all go through this map, so
 * they gain the platform without being edited.
 */
export const ADAPTERS: Record<FeedPlatform, FeedAdapter> = {
  shopify: shopifyAdapter,
  woocommerce: wooCommerceAdapter,
};

export function getAdapter(platform: string): FeedAdapter {
  const adapter = ADAPTERS[platform as FeedPlatform];
  if (!adapter) {
    throw new FeedError(`Nepalaikoma parduotuvės platforma: „${platform}".`);
  }
  return adapter;
}

export function fetchCatalog(
  platform: string,
  domain: string
): Promise<StoreCatalog> {
  return getAdapter(platform).fetchCatalog(domain);
}

/**
 * Work out which platform a domain runs, by asking it.
 *
 * Partners are asked for their web address and nothing else. A shop owner
 * reliably knows "kamadobono.lt"; whether their agency built the site on
 * WooCommerce or Shopify is a question many cannot answer, and getting it wrong
 * would produce a confusing "no products found" instead of a working feed.
 *
 * Both adapters are probed at once because the endpoints are mutually
 * exclusive in practice — a Shopify store has no /wp-json, a WooCommerce store
 * has no /products.json. Shopify wins a tie only so that existing partners keep
 * the platform they already had.
 */
export async function detectPlatform(domain: string): Promise<FeedPlatform> {
  const order: FeedPlatform[] = ["shopify", "woocommerce"];
  const results = await Promise.all(
    order.map((platform) => ADAPTERS[platform].probe(domain))
  );

  const index = results.findIndex(Boolean);
  if (index === -1) {
    throw new FeedError(
      `Nepavyko atpažinti parduotuvės „${domain}". Palaikomos Shopify ir ` +
        `WooCommerce parduotuvės su viešu produktų sąrašu.`
    );
  }
  return order[index];
}
