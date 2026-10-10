import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Shopify order webhook for one direct partner.
 *
 * The partner creates it under Settings → Notifications → Webhooks ("Order
 * creation" and "Order cancellation", JSON) pointing here, and sends us the
 * signing key Shopify shows on that page; admin stores it in
 * partner_webhook_secrets.
 *
 * Every order in the shop arrives, but only ours are kept: the order's
 * landing_site (the first URL of the session) has to carry the tag /out put
 * on it — nr_click=<sub_id>, or failing that utm_source=noriuto. Of a kept
 * order we store the id, number, total, currency and date. Never the customer.
 *
 * Must be called on www.noriuto.lt: the apex 307s, and Shopify does not follow
 * redirects.
 */

type ShopifyOrder = {
  id?: number | string;
  name?: string;
  total_price?: string;
  currency?: string;
  created_at?: string;
  cancelled_at?: string | null;
  landing_site?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verify(rawBody: string, secret: string, header: string | null): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What the landing URL says about where the shopper came from. */
function readTag(landingSite: string | null | undefined) {
  if (!landingSite) return null;
  let url: URL;
  try {
    // Shopify sends it relative ("/products/x?utm_source=…") or absolute.
    url = new URL(landingSite, "https://shop.invalid");
  } catch {
    return null;
  }
  const click = url.searchParams.get("nr_click");
  if (click && UUID.test(click)) return { clickSubId: click };
  if (url.searchParams.get("utm_source") === "noriuto") return { clickSubId: null };
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await params;
  if (!UUID.test(partnerId)) return new NextResponse(null, { status: 404 });

  const rawBody = await req.text();

  const { data: secretRow } = await supabaseAdmin
    .from("partner_webhook_secrets")
    .select("secret")
    .eq("partner_id", partnerId)
    .eq("platform", "shopify")
    .maybeSingle();
  if (!secretRow) return new NextResponse(null, { status: 404 });

  if (!verify(rawBody, secretRow.secret, req.headers.get("x-shopify-hmac-sha256"))) {
    return new NextResponse(null, { status: 401 });
  }

  // Any signed delivery — including Shopify's "Send test notification" —
  // proves the hookup works, which is what admin wants to see first.
  await supabaseAdmin
    .from("partners")
    .update({ orders_webhook_last_at: new Date().toISOString() })
    .eq("id", partnerId);

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (order.id == null) return new NextResponse(null, { status: 200 });
  const externalId = String(order.id);
  const topic = req.headers.get("x-shopify-topic");

  if (topic === "orders/cancelled") {
    await supabaseAdmin
      .from("partner_orders")
      .update({ cancelled_at: order.cancelled_at ?? new Date().toISOString() })
      .eq("partner_id", partnerId)
      .eq("platform", "shopify")
      .eq("external_order_id", externalId);
    return new NextResponse(null, { status: 200 });
  }

  const tag = readTag(order.landing_site);
  // Not from us: acknowledge and forget. Nothing about it is stored.
  if (!tag) return new NextResponse(null, { status: 200 });

  // Trust nr_click only if it is one of our clicks to this partner; otherwise
  // the order still came via a Noriuto link, just not one we can pin down.
  let clickSubId: string | null = null;
  if (tag.clickSubId) {
    const { data: click } = await supabaseAdmin
      .from("affiliate_clicks")
      .select("sub_id")
      .eq("sub_id", tag.clickSubId)
      .eq("partner_id", partnerId)
      .maybeSingle();
    clickSubId = click?.sub_id ?? null;
  }

  const total = Number(order.total_price);
  const { error } = await supabaseAdmin.from("partner_orders").upsert(
    {
      partner_id: partnerId,
      platform: "shopify",
      external_order_id: externalId,
      order_name: order.name ?? null,
      total: Number.isFinite(total) ? total : 0,
      currency: order.currency ?? "EUR",
      ordered_at: order.created_at ?? new Date().toISOString(),
      click_sub_id: clickSubId,
      attributed_by: clickSubId ? "nr_click" : "utm",
      cancelled_at: order.cancelled_at ?? null,
    },
    // Shopify retries deliveries; a repeat must not double-count.
    { onConflict: "partner_id,platform,external_order_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[shopify webhook] order insert failed", error);
    // 500 so Shopify retries rather than the sale being lost.
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
