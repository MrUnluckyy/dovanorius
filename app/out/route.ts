import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { resolveMerchant } from "@/utils/affiliate/resolveMerchant";
import { buildDeeplink } from "@/utils/affiliate/buildDeeplink";
import { resolvePartner, tagPartnerUrl } from "@/utils/affiliate/partnerLink";
import type { AffiliateCredentials } from "@/types/affiliate";
import { normalizeShopUrl, unwrapOwnOut } from "@/utils/affiliate/outHref";
import { advertiserOf, networkOf, tagNetworkLink } from "@/utils/affiliate/networkLink";

export const dynamic = "force-dynamic";

function invalidLinkPage(): string {
  return `<!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Nuoroda neveikia - Noriuto</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7f5;color:#222}
  main{max-width:420px;padding:32px 24px;text-align:center}
  h1{font-size:22px;margin:0 0 12px}
  p{line-height:1.5;margin:0 0 20px;color:#555}
  a{display:inline-block;padding:12px 20px;border-radius:999px;background:#222;color:#fff;text-decoration:none}
</style>
</head>
<body>
<main>
  <h1>Ši nuoroda neveikia</h1>
  <p>Prie šio noro išsaugota nuoroda nėra tinkamas parduotuvės adresas. Paklauskite sąrašo savininko, kur šį daiktą galima rasti.</p>
  <a href="/">Į Noriuto</a>
</main>
</body>
</html>`;
}

function credentials(): AffiliateCredentials {
  return {
    awinPublisherId: process.env.AWIN_PUBLISHER_ID,
    tradedoublerAffiliateId: process.env.TRADEDOUBLER_AFFILIATE_ID,
    cjWebsiteId: process.env.CJ_WEBSITE_ID,
    sovrnKey: process.env.SOVRN_KEY,
  };
}

/**
 * First-party outbound redirect. Resolves the target URL's merchant, logs the
 * click for attribution, and 302s to a tracked affiliate deeplink — falling
 * back to Sovrn (if configured) and finally to the raw URL so a click never
 * breaks.
 *
 *   /out?u=<encoded product url>&item=<item id?>   (board items)
 *   /out?u=<encoded product url>&p=<partner:uuid>   (Discover partner products)
 *   /out?d=<encoded network link>&p=<product id>    (Discover affiliate products)
 *
 * Direct partners have no network, so their links are tagged here instead:
 * utm_* plus nr_click=<sub_id>, the key a later order is matched on.
 */
/** Discover feed product ids (awc-/tdc-/cjc- concepts, legacy numeric Awin ids). */
const FEED_PRODUCT = /^(awc|tdc|cjc)-[0-9a-f]{16}$|^\d{6,20}$/i;

/** The signed-in user's id, if any; never blocks the redirect. */
async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * A Discover affiliate product: the feed already gave us the network's tracked
 * link. Add our sub id to it (Awin clickref, TradeDoubler epi, CJ sid) so the
 * network reports it back with the sale, log the click, and redirect. Only the
 * networks' own tracking hosts are accepted (tagNetworkLink returns null for
 * anything else), so this is not an open redirect.
 */
async function networkLinkRedirect(link: string, rawProduct: string | null, itemId: string | null = null) {
  const subId = crypto.randomUUID();
  const tagged = tagNetworkLink(link, subId);
  if (!tagged) {
    return new NextResponse(invalidLinkPage(), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const productId = rawProduct && FEED_PRODUCT.test(rawProduct) ? rawProduct : null;

  try {
    const info = advertiserOf(link);
    let merchantId: string | null = null;
    if (info?.advertiserId) {
      const { data } = await supabaseAdmin
        .from("affiliate_merchants")
        .select("id")
        .eq("network", info.network)
        .eq("network_advertiser_id", info.advertiserId)
        .limit(1)
        .maybeSingle();
      merchantId = data?.id ?? null;
    } else if (info?.targetUrl) {
      merchantId = (await resolveMerchant(info.targetUrl))?.id ?? null;
    }
    const click = {
      // A wish saved from Discover keeps its tracked link; the wish id says
      // which board it was opened from.
      item_id: itemId && /^[0-9a-f-]{36}$/i.test(itemId) ? itemId : null,
      user_id: await currentUserId(),
      merchant_id: merchantId,
      partner_id: null,
      product_id: productId,
      target_url: info?.targetUrl ?? link,
      sub_id: subId,
    };
    const { error } = await supabaseAdmin.from("affiliate_clicks").insert(click);
    // A deleted wish (foreign key) must not cost us the click itself.
    if (error?.code === "23503" && click.item_id) {
      await supabaseAdmin.from("affiliate_clicks").insert({ ...click, item_id: null });
    } else if (error) {
      console.error("[out] discover click log failed", error.message);
    }
  } catch (e) {
    console.error("[out] discover click log failed", e);
  }
  return NextResponse.redirect(tagged, 302);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const networkLink = searchParams.get("d");
  if (networkLink) return networkLinkRedirect(networkLink, searchParams.get("p"));
  // A wish can store one of our own /out links (the app saves Discover ideas
  // that way); follow it to the shop here instead of redirecting to ourselves.
  const unwrapped = searchParams.get("u") ? unwrapOwnOut(searchParams.get("u")!) : null;
  const raw = unwrapped?.url ?? null;
  const itemId = searchParams.get("item");
  // Only served partner rows; anything else is ignored rather than stored.
  const rawProduct = searchParams.get("p") ?? unwrapped?.productId ?? null;
  const productId =
    rawProduct && /^partner:[0-9a-f-]{36}$/i.test(rawProduct) ? rawProduct : null;

  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // A network's tracked link in u= (the app's Discover opens /out?u=<feed
  // link>, and wishes saved from it store that): tag it like ?d= instead of
  // passing it through without our sub id.
  if (networkOf(raw)) {
    return networkLinkRedirect(raw, searchParams.get("p") ?? unwrapped?.productId ?? null, searchParams.get("item"));
  }

  // Only ever redirect to absolute http(s) URLs (block javascript:, data:, …).
  // Scheme-less links ("www.shop.lt/...") get https:// added.
  const normalized = normalizeShopUrl(raw);
  if (!normalized) {
    // A person opened this from a wishlist: show a page, not raw JSON.
    return new NextResponse(invalidLinkPage(), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const targetUrl = normalized;

  const creds = credentials();
  const subId = crypto.randomUUID();

  const merchant = await resolveMerchant(targetUrl);
  // Partner shops are checked only when no network owns the host.
  const partnerId = merchant ? null : await resolvePartner(targetUrl);

  let redirectTo = targetUrl;
  let merchantId: string | null = null;

  if (merchant) {
    const deeplink = buildDeeplink({
      merchant,
      targetUrl,
      subId,
      credentials: creds,
    });
    if (deeplink) {
      redirectTo = deeplink;
      merchantId = merchant.id;
    }
  } else if (partnerId) {
    const source = productId ? "discover" : searchParams.get("src") === "shop" ? "shop" : "board";
    redirectTo = tagPartnerUrl(targetUrl, subId, source);
  } else if (creds.sovrnKey && process.env.SOVRN_DEEPLINK_TEMPLATE) {
    // No known merchant → auto-affiliate the long tail through Sovrn.
    const deeplink = buildDeeplink({
      merchant: {
        network: "sovrn",
        network_advertiser_id: null,
        deeplink_template: process.env.SOVRN_DEEPLINK_TEMPLATE,
      },
      targetUrl,
      subId,
      credentials: creds,
    });
    if (deeplink) redirectTo = deeplink;
  }

  // Best-effort click log; never block the redirect on it.
  try {
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // no session / server-component cookie write — ignore
    }

    await supabaseAdmin.from("affiliate_clicks").insert({
      item_id: itemId || null,
      user_id: userId,
      merchant_id: merchantId,
      partner_id: partnerId,
      product_id: productId,
      target_url: targetUrl,
      sub_id: subId,
    });
  } catch (e) {
    console.error("[out] click log failed", e);
  }

  return NextResponse.redirect(redirectTo, 302);
}
