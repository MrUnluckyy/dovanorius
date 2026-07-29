import { NextResponse } from "next/server";
import { getGiftIdeas } from "@/lib/gifts/recommend";

export const dynamic = "force-dynamic";

/**
 * Personalized gift ideas for a user (works for self OR for gifting a friend
 * whose profile is public). Returns the inferred taste profile, ranked gifts
 * with reasons, and the real LLM cost of the call.
 *
 *   /api/gift-ideas?userId=<uuid>&occasion=any
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const occasion = searchParams.get("occasion") ?? "any";
  const num = (v: string | null) => (v != null && v !== "" ? Number(v) : null);
  const priceMin = num(searchParams.get("priceMin"));
  const priceMax = num(searchParams.get("priceMax"));

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 503 }
    );
  }

  try {
    const result = await getGiftIdeas(userId, occasion, { priceMin, priceMax });
    return NextResponse.json({
      from_cache: result.fromCache,
      cost_usd: Number(result.cost.toFixed(6)),
      profile: result.profile,
      ideas: result.ideas,
    });
  } catch (e) {
    console.error("[gift-ideas]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
