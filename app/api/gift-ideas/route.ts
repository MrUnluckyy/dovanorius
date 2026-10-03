import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAccountUser } from "@/utils/auth/account";
import { getGiftIdeas, GiftIdeasRateLimitError } from "@/lib/gifts/recommend";
import { OCCASIONS, PRICE_CAP, PRICE_STEP, type Occasion } from "@/lib/gifts/config";

export const dynamic = "force-dynamic";

/** Snap a budget to PRICE_STEP so prices can't be varied to dodge the cache. */
function priceBand(v: string | null, round: (n: number) => number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > PRICE_CAP) return null;
  return round(n / PRICE_STEP) * PRICE_STEP;
}

/**
 * Personalized gift ideas for the signed-in user. Returns the inferred taste
 * profile, ranked gifts with reasons, and the real LLM cost of the call.
 *
 *   /api/gift-ideas?userId=<own uuid>&occasion=any
 *
 * Every cache miss is a paid model call, so: accounts only (no guests), only
 * your own ideas, occasion from a fixed list, prices snapped to bands, and a
 * per-person hourly cap on misses (see lib/gifts/config.ts).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAccountUser(user)) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? user.id;
  if (userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const occasionParam = searchParams.get("occasion") ?? "any";
  if (!OCCASIONS.includes(occasionParam as Occasion)) {
    return NextResponse.json({ error: "Unknown occasion" }, { status: 400 });
  }
  const occasion = occasionParam as Occasion;
  const priceMin = priceBand(searchParams.get("priceMin"), Math.floor);
  const priceMax = priceBand(searchParams.get("priceMax"), Math.ceil);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Gift ideas are unavailable" },
      { status: 503 }
    );
  }

  try {
    const result = await getGiftIdeas(user.id, occasion, { priceMin, priceMax });
    return NextResponse.json({
      from_cache: result.fromCache,
      cost_usd: Number(result.cost.toFixed(6)),
      profile: result.profile,
      ideas: result.ideas,
    });
  } catch (e) {
    if (e instanceof GiftIdeasRateLimitError) {
      return NextResponse.json(
        { error: "Too many requests, try again later" },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
    console.error("[gift-ideas]", e);
    return NextResponse.json(
      { error: "Failed to load gift ideas" },
      { status: 500 }
    );
  }
}
