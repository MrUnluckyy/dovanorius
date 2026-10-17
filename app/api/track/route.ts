import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import {
  PRODUCT_EVENT_TYPES,
  PAGE_EVENT_TYPES,
  CONTEXT_KEYS,
} from "@/utils/trackInspo";

export const dynamic = "force-dynamic";

const PRODUCT_EVENTS = new Set<string>(PRODUCT_EVENT_TYPES);
const PAGE_EVENTS = new Set<string>(PAGE_EVENT_TYPES);

/**
 * A discover session: rolling 30 minutes of inactivity, the usual web
 * analytics definition. Set here rather than on the client so the web needs
 * no browser-storage code; it is an analytics id, not an answer about the
 * visitor. noriuto-app has no cookie jar for this origin and sends its own
 * `sessionId` in the body instead.
 */
const SESSION_COOKIE = "nr_sid";
const SESSION_TTL_S = 30 * 60;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Only short, known string values get through. Context is read in SQL views,
 * so an open-ended object from the client would be both a size and a poisoning
 * risk.
 */
function cleanContext(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const key of CONTEXT_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0 && v.length <= 64) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Fire-and-forget engagement beacon for the discover feed.
 *
 * Product events ({ type, productId }) look merchant / brand / product_type /
 * price up server-side (authoritative, and works for AI-suggested products
 * too). Page events (discover_view, recipient_selected, nudge_*) carry no
 * product. user_id is always taken from the session rather than trusted from
 * the client.
 */
export async function POST(req: Request) {
  let body: {
    type?: unknown;
    productId?: unknown;
    context?: unknown;
    sessionId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { type, productId } = body;
  if (typeof type !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const isProductEvent = PRODUCT_EVENTS.has(type);
  if (!isProductEvent && !PAGE_EVENTS.has(type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (isProductEvent && (typeof productId !== "string" || !productId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const jar = await cookies();
  const fromBody =
    typeof body.sessionId === "string" && SESSION_ID_RE.test(body.sessionId)
      ? body.sessionId
      : null;
  const fromCookie = jar.get(SESSION_COOKIE)?.value;
  const sessionId =
    fromBody ??
    (fromCookie && SESSION_ID_RE.test(fromCookie)
      ? fromCookie
      : crypto.randomUUID());

  // Session is optional — anonymous browsing is tracked with a null user_id.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = isProductEvent
    ? await supabaseAdmin
        .from("inspo_products")
        .select("merchant_name, brand_name, product_type, price")
        .eq("id", productId as string)
        .maybeSingle()
    : { data: null };

  await supabaseAdmin.from("inspo_events").insert({
    event_type: type,
    product_id: isProductEvent ? (productId as string) : null,
    merchant_name: product?.merchant_name ?? null,
    brand_name: product?.brand_name ?? null,
    product_type: product?.product_type ?? null,
    price: product?.price ?? null,
    user_id: user?.id ?? null,
    session_id: sessionId,
    context: cleanContext(body.context),
  });

  const res = NextResponse.json({ ok: true });
  // Re-set on every event so the 30 minutes roll. Skipped when the app sent
  // its own id: it does not read cookies, and overwriting a web visitor's
  // session from an app request would merge two different sessions.
  if (!fromBody) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      maxAge: SESSION_TTL_S,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
}
