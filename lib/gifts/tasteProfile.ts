import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { GIFT_MODEL } from "./config";
import { TasteProfileSchema, type TasteProfile } from "./schema";
import { getUserSignals, signalsHash, type UserSignals } from "./signals";
import { usdCost } from "./cost";

// Stable instruction → cached across every user (0.1x on repeat reads).
const SYSTEM = `You build a concise gift-taste profile for one person, to power gift recommendations in a Lithuanian gift app. You receive their wishlist items (titles are often Lithuanian), board names, a short bio, and age.

The data may include "liked" and "disliked" products — direct relevance feedback the person gave. Weight these heavily: lean interests/categories/brands toward what they liked and away from what they disliked.

Infer, using ONLY the provided data (never invent specifics):
- interests: 4-10 concrete, English, retrieval-friendly keywords for hobbies/themes to search a product catalog (e.g. "running","cycling","hiking","3d printing","parenting"). Prefer specific over generic. Include themes implied by liked products.
- categories: which of beauty/shoes/clothing/bag/accessory/other they'd most want as gifts. Reflect liked/disliked categories.
- brands: brands they show affinity for (from item titles and liked products), if any.
- price_min / price_max: the EUR range that fits their shown items (null if unclear).
- gender: the person's likely gender for catalog filtering (male/female/unisex), inferred from name/bio/items; use "unisex" if genuinely unclear.
- life_context: notable context that changes gifting (e.g. "parent of a young child","tech hobbyist").
- summary: one warm sentence describing them.`;

export type TasteProfileResult = {
  profile: TasteProfile;
  hash: string;
  cost: number;
  cached: boolean;
  signals: UserSignals;
};

/** Cached read; re-infers via the LLM only when the user's signals changed. */
export async function getOrInferTasteProfile(
  userId: string
): Promise<TasteProfileResult> {
  const signals = await getUserSignals(userId);
  const hash = signalsHash(signals);

  const { data: cached } = await supabaseAdmin
    .from("user_taste_profiles")
    .select("profile, signals_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (cached && cached.signals_hash === hash) {
    return {
      profile: cached.profile as TasteProfile,
      hash,
      cost: 0,
      cached: true,
      signals,
    };
  }

  const client = new Anthropic();
  const res = await client.messages.parse({
    model: GIFT_MODEL,
    max_tokens: 700,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(signals) }],
    output_config: { format: zodOutputFormat(TasteProfileSchema) },
  });

  const profile = res.parsed_output;
  if (!profile) throw new Error("Taste profile did not parse");

  await supabaseAdmin.from("user_taste_profiles").upsert({
    user_id: userId,
    profile,
    signals_hash: hash,
    model: GIFT_MODEL,
    updated_at: new Date().toISOString(),
  });

  return { profile, hash, cost: usdCost(GIFT_MODEL, res.usage), cached: false, signals };
}
