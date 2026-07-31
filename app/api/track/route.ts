import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_TYPES = new Set(["open", "save", "click_out"]);

/**
 * Fire-and-forget engagement beacon for the discover feed. The client sends
 * only { type, productId }; merchant / brand / product_type / price are looked
 * up server-side (authoritative, and works for AI-suggested products too), and
 * user_id is taken from the session rather than trusted from the client.
 */
export async function POST(req: Request) {
  let body: { type?: unknown; productId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { type, productId } = body;
  if (
    typeof type !== "string" ||
    !EVENT_TYPES.has(type) ||
    typeof productId !== "string" ||
    !productId
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Session is optional — anonymous browsing is tracked with a null user_id.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabaseAdmin
    .from("inspo_products")
    .select("merchant_name, brand_name, product_type, price")
    .eq("id", productId)
    .maybeSingle();

  await supabaseAdmin.from("inspo_events").insert({
    event_type: type,
    product_id: productId,
    merchant_name: product?.merchant_name ?? null,
    brand_name: product?.brand_name ?? null,
    product_type: product?.product_type ?? null,
    price: product?.price ?? null,
    user_id: user?.id ?? null,
  });

  return NextResponse.json({ ok: true });
}
