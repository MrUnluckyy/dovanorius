import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { resolveMerchant } from "@/utils/affiliate/resolveMerchant";
import { buildDeeplink } from "@/utils/affiliate/buildDeeplink";
import type { AffiliateCredentials } from "@/types/affiliate";

export const dynamic = "force-dynamic";

function credentials(): AffiliateCredentials {
  return {
    awinPublisherId: process.env.AWIN_PUBLISHER_ID,
    tradedoublerAffiliateId: process.env.TRADEDOUBLER_AFFILIATE_ID,
    sovrnKey: process.env.SOVRN_KEY,
  };
}

/**
 * First-party outbound redirect. Resolves the target URL's merchant, logs the
 * click for attribution, and 302s to a tracked affiliate deeplink — falling
 * back to Sovrn (if configured) and finally to the raw URL so a click never
 * breaks.
 *
 *   /out?u=<encoded product url>&item=<item id?>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("u");
  const itemId = searchParams.get("item");

  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only ever redirect to absolute http(s) URLs (block javascript:, data:, …).
  let target: URL;
  try {
    target = new URL(raw);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  const targetUrl = target.toString();

  const creds = credentials();
  const subId = crypto.randomUUID();

  const merchant = await resolveMerchant(targetUrl);

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
      target_url: targetUrl,
      sub_id: subId,
    });
  } catch (e) {
    console.error("[out] click log failed", e);
  }

  return NextResponse.redirect(redirectTo, 302);
}
