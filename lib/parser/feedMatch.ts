/**
 * A pasted shop link answered from our own product feeds, for shops whose
 * pages we can't read (pigu and notino sit behind bot protection).
 *
 * Only networks whose tracked link embeds the shop's own URL can be matched
 * this way: TradeDoubler `url(<encoded>)` and CJ `?url=<encoded>`. Awin links
 * (douglas, modivo, eavalyne, iherb) carry only a product id, so they need the
 * importer to store the merchant URL first.
 *
 * Measured 2026-11-15: feeds hold part of each catalogue, so this answers
 * about 18% of saved pigu links and 29% of notino ones. Free and instant, so
 * worth asking before giving up, not before fetching.
 */
import { createClient } from "@supabase/supabase-js";

type FeedShop = {
  merchant: string;
  /** The part of the shop URL that identifies the product, unencoded. */
  key: (url: URL) => string | null;
};

const lastSegment = (u: URL) => u.pathname.replace(/\/+$/, "").split("/").pop() || null;
const fullPath = (u: URL) => u.pathname.replace(/\/+$/, "") || null;

const FEED_SHOPS: Record<string, FeedShop> = {
  // pigu.lt/lt/<category>/<slug>?id=… — the slug is unique; categories move.
  "pigu.lt": { merchant: "Pigu.lt", key: lastSegment },
  // notino.lt/<brand>/<product>/p-123/ — p-123 is a size variant; the feed
  // may list another one of the same product.
  "notino.lt": {
    merchant: "Notino.lt",
    key: (u) => fullPath(u)?.replace(/\/p-\d+$/i, "") || null,
  },
  "aboutyou.lt": { merchant: "About You LT", key: fullPath },
  "4fstore.lt": { merchant: "4F LT", key: fullPath },
  "dyson.lt": { merchant: "Dyson LT", key: fullPath },
  "sizeer.lt": { merchant: "Sizeer.lt", key: fullPath },
  "shop.philips.lt": { merchant: "Philips LT", key: fullPath },
};

export type FeedHit = {
  title: string;
  brand: string | null;
  price: string | null;
  image: string | null;
};

/**
 * The key encoded the way the feeds encode it ("/chi/argan" → "%2Fchi%2Fargan"),
 * with LIKE's own wildcards escaped: encoded text is full of "%".
 */
function encodedLikeKey(key: string): string {
  return encodeURIComponent(key).replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function matchFeed(url: string): Promise<FeedHit | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const shop = FEED_SHOPS[u.hostname.replace(/^www\./i, "")];
  const key = shop?.key(u);
  // A short key would match half the catalogue.
  if (!shop || !key || key.replace(/[^a-z0-9]/gi, "").length < 8) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The key is percent-encoded inside the tracked link ("%2Fchi%2Fargan-oil").
  // encodeURIComponent leaves "-" and letters alone and turns "/" into %2F,
  // matching how both networks encode the target.
  const pattern = `%${encodedLikeKey(key)}%`;
  const { data, error } = await supabase
    .from("inspo_products")
    .select("product_name, brand_name, price, image_url")
    .eq("merchant_name", shop.merchant)
    .like("deep_link", pattern)
    .order("in_stock", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;

  const row = data[0];
  return {
    title: row.product_name,
    brand: row.brand_name ?? null,
    price: row.price != null ? String(row.price) : null,
    image: row.image_url ?? null,
  };
}
