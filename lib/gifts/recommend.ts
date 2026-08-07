import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { GIFT_MODEL, MAX_PICKS, REC_TTL_HOURS } from "./config";
import { PicksSchema, type TasteProfile } from "./schema";
import { getOrInferTasteProfile } from "./tasteProfile";
import { retrieveCandidates } from "./candidates";
import { getDislikedProductIds, type UserSignals } from "./signals";
import { usdCost } from "./cost";

export type GiftIdea = {
  product_id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  deep_link: string | null;
  reason: string;
};

export type GiftIdeasResult = {
  profile: TasteProfile;
  signals: UserSignals;
  ideas: GiftIdea[];
  cost: number;
  fromCache: boolean;
};

const SYSTEM = `You are a thoughtful gift concierge for a Lithuanian gift app. Given a person's taste profile (including their gender) and a list of candidate products (Lithuanian names), choose the best gifts for the given occasion, ordered best-first, up to max_picks.

Rules:
- Only use product_id values from the candidates. Never invent products.
- GENDER: never pick items for the opposite gender to the recipient. The catalog gender label is often missing, so judge from the product name and brand — e.g. suknelė/dress, women's coat, sijonas/skirt, liemenėlė/bra, high heels, lūpų dažai/lipstick, and women-only fashion labels are female; skip them for a man (and vice-versa). When genuinely unsure, skip the item.
- VARIETY: spread picks across product categories (clothing, shoes, beauty, bags, accessories, and non-fashion gifts such as tools, toys, tech, sport and home) — do NOT return mostly one category like all shoes. Avoid several near-identical items.
- Prefer products that clearly match an interest, brand, or life-context over generic ones. If few candidates truly fit, return fewer picks rather than padding.
- For each pick write "reason" in Lithuanian: one short, specific sentence tying the gift to the person (their hobby, brand, life context, or price fit). Be concrete ("Puikiai tinka bėgimo pomėgiui"), never generic ("graži dovana").`;

export type GiftIdeasOpts = {
  priceMin?: number | null;
  priceMax?: number | null;
};

/** Cached read; runs the ranker only on a cache miss (per subject+occasion+price+profile version). */
export async function getGiftIdeas(
  subjectUserId: string,
  occasion = "any",
  opts: GiftIdeasOpts = {}
): Promise<GiftIdeasResult> {
  const { profile, hash, cost: profileCost, signals } =
    await getOrInferTasteProfile(subjectUserId);

  // Price band is part of the cache identity (stored in the occasion column so
  // no schema change): different budgets get different cached picks.
  const cacheKey =
    opts.priceMin != null || opts.priceMax != null
      ? `${occasion}|p:${opts.priceMin ?? ""}-${opts.priceMax ?? ""}`
      : occasion;

  const { data: cached } = await supabaseAdmin
    .from("gift_recommendations")
    .select("recommendations")
    .eq("subject_user_id", subjectUserId)
    .eq("occasion", cacheKey)
    .eq("profile_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return {
      profile,
      signals,
      ideas: cached.recommendations as GiftIdea[],
      cost: profileCost,
      fromCache: true,
    };
  }

  const excludeIds = await getDislikedProductIds(subjectUserId);
  const candidates = await retrieveCandidates(profile, {
    excludeIds,
    priceMin: opts.priceMin,
    priceMax: opts.priceMax,
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const client = new Anthropic();
  const res = await client.messages.parse({
    model: GIFT_MODEL,
    max_tokens: 1500,
    // Thinking off: keeps parity with the previous no-thinking behavior and
    // reserves the whole max_tokens budget for the ranked JSON output (Sonnet 5
    // would otherwise run adaptive thinking by default and could truncate it).
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          occasion,
          max_picks: MAX_PICKS,
          profile,
          candidates: candidates.map((c) => ({
            id: c.id,
            name: c.product_name,
            brand: c.brand_name,
            price: c.price,
            type: c.product_type,
          })),
        }),
      },
    ],
    output_config: { format: zodOutputFormat(PicksSchema) },
  });

  const picks = res.parsed_output?.picks ?? [];
  const ideas: GiftIdea[] = picks
    .filter((p) => byId.has(p.product_id))
    .slice(0, MAX_PICKS)
    .map((p) => {
      const c = byId.get(p.product_id)!;
      return {
        product_id: p.product_id,
        title: c.product_name,
        price: c.price,
        image_url: c.image_url,
        deep_link: c.deep_link,
        reason: p.reason,
      };
    });

  await supabaseAdmin.from("gift_recommendations").insert({
    subject_user_id: subjectUserId,
    occasion: cacheKey,
    recommendations: ideas,
    profile_hash: hash,
    model: GIFT_MODEL,
    expires_at: new Date(Date.now() + REC_TTL_HOURS * 3600e3).toISOString(),
  });

  return {
    profile,
    signals,
    ideas,
    cost: profileCost + usdCost(GIFT_MODEL, res.usage),
    fromCache: false,
  };
}
