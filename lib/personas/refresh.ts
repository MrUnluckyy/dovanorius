import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GIFT_MODEL } from "../gifts/config";
import { usdCost } from "../gifts/cost";

/**
 * Persona shelf curation.
 *
 * Same shape as the personal gift engine (retrieve cheaply in SQL → let the
 * model judge → cache the result), with one difference that matters: this runs
 * on a schedule, not per request. A persona is the same for every visitor, so
 * one weekly pass serves everyone — including logged-out visitors, who get no
 * personalisation at all today.
 *
 * Keyword rules alone were never going to be accurate over 326k rows; they only
 * narrow the field. The model does the judging, calibrated by each persona's
 * `examples` — which is how taste gets encoded without hand-picking shelves.
 */

/** More than a shelf shows, so the page can rotate daily for free. */
const KEEP_PER_PERSONA = 40;
/**
 * Candidates handed to the model. Cost scales with this.
 *
 * 150 produced shelves of 9-22 picks against a target of 40 — thin enough that
 * daily rotation would visibly repeat within a week. The model is not being too
 * strict (rejecting ~90% of a pool is the behaviour we want; that is what keeps
 * filler out), it simply had too little to choose from. Doubling the pool is the
 * lever, at roughly $0.20 per persona per weekly run.
 */
const CANDIDATE_LIMIT = 300;

export type Persona = {
  id: string;
  slug: string;
  label_lt: string;
  description: string;
  gender: "female" | "male" | null;
  age_min: number | null;
  age_max: number | null;
  product_types: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  price_min: number;
  price_max: number;
  examples: string[];
};

type Candidate = {
  id: string;
  product_name: string;
  brand_name: string | null;
  price: number | null;
  product_type: string | null;
};

const PicksSchema = z.object({
  picks: z.array(z.object({ product_id: z.string(), reason: z.string() })),
});

const SYSTEM = `You curate gift shelves for a Lithuanian gift app. You are given a recipient persona, example gifts that capture the right taste, and a list of catalogue candidates (Lithuanian product names).

Pick the products that genuinely suit this person, best first, up to max_picks.

Rules:
- Only use product_id values from the candidates. Never invent products.
- AGE SAFETY is absolute: never pick anything unsuitable for the persona's age. No alcohol, no adult items, nothing with small parts for a baby or toddler.
- Match the SPIRIT of the examples, not their literal words — they show the taste level expected, not a shopping list.
- Reject filler. A shelf of 20 excellent gifts beats 40 padded ones, so return fewer picks rather than weak ones.
- VARIETY is a hard requirement, judged on what the object actually IS, not on the category label we send you: at most 2 picks of the same kind of thing (e.g. at most 2 scented candles, 2 mugs, 2 backpacks). A shelf of eight candles is a failure even if every candle is excellent. Also avoid the same product in another colour or size.
- For each pick write "reason" in Lithuanian: one short, concrete sentence saying why it fits THIS person ("Puikiai tinka pradedančiam bėgikui"), never generic praise ("graži dovana").`;

/** Cheap, index-backed candidate pool from the persona's own rules. */
export async function retrievePersonaCandidates(
  supabase: SupabaseClient,
  persona: Persona
): Promise<Candidate[]> {
  // A factory, not a value: Supabase query builders are single-use, and the
  // per-type fan-out below needs a fresh one each time.
  const base = () => {
    const q = supabase
      .from("inspo_products")
      .select("id, product_name, brand_name, price, product_type")
      .eq("in_stock", true)
      .eq("giftable", true)
      .not("image_url", "is", null)
      .not("deep_link", "is", null)
      .gte("price", persona.price_min)
      .lte("price", persona.price_max)
      .gte("gift_score", 45);

    // Gender is a hint, never a hard filter: outside fashion it is almost
    // entirely null, so filtering on it would empty most persona shelves.
    if (persona.gender === "male") return q.or("gender.neq.female,gender.is.null");
    if (persona.gender === "female") return q.or("gender.neq.male,gender.is.null");
    return q;
  };

  // One bounded query per product_type, each with its own quota.
  //
  // Two earlier approaches failed. Fetching the top N by gift_score across all
  // types let the biggest category crowd out the rest — "child" filled with
  // adult sport gear (sport 5.6k rows vs toys 4.6k) and the model rightly kept
  // only 4 of 150. Filtering with an OR of ilike '%keyword%' fixed the mix but
  // timed out: seven trigram patterns plus the score filter and an ordered
  // limit is far too slow over 326k rows, and the client surfaces that as
  // "TypeError: fetch failed".
  //
  // A per-type quota needs no text matching at all: every category is
  // guaranteed its share, and each query is a plain index range read.
  const types = persona.product_types.length ? persona.product_types : [null];
  const perType = Math.max(20, Math.ceil((CANDIDATE_LIMIT * 1.5) / types.length));

  const buckets = await Promise.all(
    types.map(async (type) => {
      let tq = base();
      if (type) tq = tq.eq("product_type", type);
      const { data, error } = await tq
        .order("gift_score", { ascending: false })
        .order("sort_key", { ascending: true })
        .limit(perType);
      if (error) throw new Error(`candidates(${type ?? "all"}): ${error.message}`);
      return (data ?? []) as Candidate[];
    })
  );

  const exclude = persona.exclude_keywords.map((k) => k.toLowerCase());
  const include = persona.include_keywords.map((k) => k.toLowerCase());

  const kept = buckets
    .flat()
    .filter((r) => {
      const name = (r.product_name ?? "").toLowerCase();
      return !exclude.some((k) => k && name.includes(k));
    });

  // Keywords now only PREFER within an already balanced pool, which is all they
  // were ever able to do reliably.
  const scored = kept.map((r) => ({
    r,
    hits: include.filter((k) => k && (r.product_name ?? "").toLowerCase().includes(k)).length,
  }));
  // Keyword matches get HALF the pool, no more.
  //
  // Sorting the whole pool by hit count let one keyword monopolise it: the
  // cosy-home shelf listed `žvakė` among its terms and came back as eight
  // candles out of eight — from a pool that holds only 38 candles against 2,604
  // other items. The terms are a nudge toward the theme, not a definition of it,
  // so the rest of the pool stays open for things nobody thought to name.
  const matched = scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
  const rest = scored.filter((s) => s.hits === 0);

  const half = Math.floor(CANDIDATE_LIMIT / 2);
  const pool = [
    ...matched.slice(0, half),
    ...rest.slice(0, CANDIDATE_LIMIT - Math.min(matched.length, half)),
  ];

  return pool.slice(0, CANDIDATE_LIMIT).map((s) => s.r);
}

export type RefreshResult = {
  slug: string;
  candidates: number;
  kept: number;
  costUsd: number;
};

export async function refreshPersona(
  supabase: SupabaseClient,
  persona: Persona
): Promise<RefreshResult> {
  const candidates = await retrievePersonaCandidates(supabase, persona);
  if (!candidates.length) {
    return { slug: persona.slug, candidates: 0, kept: 0, costUsd: 0 };
  }

  const client = new Anthropic();
  const res = await client.messages.parse({
    model: GIFT_MODEL,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          persona: {
            who: persona.description,
            age_min: persona.age_min,
            age_max: persona.age_max,
            gender: persona.gender,
          },
          example_gifts: persona.examples,
          max_picks: KEEP_PER_PERSONA,
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

  // Dedupe by product_id before slicing: the model occasionally returns the
  // same product twice (usually with two different reasons), which collides on
  // persona_products' (persona_id, product_id) primary key and fails the whole
  // insert — leaving that persona with an empty shelf, since the delete has
  // already run. First mention wins, as it carries the model's own ranking.
  const byId = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  const picks = (res.parsed_output?.picks ?? [])
    .filter((p) => {
      if (!byId.has(p.product_id) || seen.has(p.product_id)) return false;
      seen.add(p.product_id);
      return true;
    })
    .slice(0, KEEP_PER_PERSONA);

  // Replace wholesale: a stale pick whose product has since gone out of stock
  // should disappear, not linger behind the new ones.
  const { error: delErr } = await supabase
    .from("persona_products")
    .delete()
    .eq("persona_id", persona.id);
  if (delErr) throw new Error(`clear: ${delErr.message}`);

  if (picks.length) {
    const { error: insErr } = await supabase.from("persona_products").insert(
      picks.map((p, i) => ({
        persona_id: persona.id,
        product_id: p.product_id,
        rank: i + 1,
        reason: p.reason,
      }))
    );
    if (insErr) throw new Error(`insert: ${insErr.message}`);
  }

  return {
    slug: persona.slug,
    candidates: candidates.length,
    kept: picks.length,
    costUsd: usdCost(GIFT_MODEL, res.usage),
  };
}
