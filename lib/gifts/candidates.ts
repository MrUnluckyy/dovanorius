import { supabaseAdmin } from "@/utils/supabase/admin";
import { CANDIDATE_LIMIT } from "./config";
import type { TasteProfile } from "./schema";

export type Candidate = {
  id: string;
  product_name: string;
  brand_name: string | null;
  price: number | null;
  product_type: string | null;
  gender: string | null;
  image_url: string | null;
  deep_link: string | null;
};

const SELECT =
  "id, product_name, brand_name, price, product_type, gender, image_url, deep_link";

// Categories to spread candidates across, so a sporty man doesn't get only
// shoes. Retrieval pulls a bucket per type and round-robins them together.
const TYPES = ["clothing", "shoes", "beauty", "bag", "accessory", "other"] as const;
const PER_TYPE = 12;

/**
 * Types that may only contribute INTEREST-MATCHED rows, never a generic sample.
 *
 * "other" is the catalogue's largest bucket (~91k: tools, toys, electronics,
 * furniture, car parts) and the only home for non-fashion gifts — a hobbyist's
 * LEGO, 3D-printer parts or fishing gear are all here, so excluding it starved
 * exactly the profiles it should serve best. But it is a junk drawer: sampled
 * blind it yields car mats and sofas, so it earns its place only when a term
 * from the person's interests or brands actually matches.
 */
const INTEREST_MATCHED_ONLY = new Set<string>(["other"]);

export type RetrieveOpts = {
  /** Disliked product ids to hard-exclude. */
  excludeIds?: string[];
  /** Global price band (overrides the profile's inferred range when set). */
  priceMin?: number | null;
  priceMax?: number | null;
};

// PostgREST `or=` uses commas/parens as syntax — keep interest terms word-only.
function sanitize(term: string): string {
  return term.replace(/[,()%]/g, " ").trim();
}

function baseQuery(profile: TasteProfile, opts: RetrieveOpts) {
  const min = Math.max(10, opts.priceMin ?? profile.price_min ?? 0);
  let q = supabaseAdmin
    .from("inspo_products")
    .select(SELECT)
    .eq("in_stock", true)
    .not("image_url", "is", null)
    .not("deep_link", "is", null)
    .gte("price", min);

  const max = opts.priceMax ?? profile.price_max;
  if (max) q = q.lte("price", max);

  // Gender (lenient): drop only the KNOWN opposite gender. Keep matching +
  // unisex + unknown (null) so the unclassified fashion catalog stays in play
  // for variety — the ranker screens obvious opposite-gender items by name.
  if (profile.gender === "male") q = q.neq("gender", "female");
  else if (profile.gender === "female") q = q.neq("gender", "male");

  if (opts.excludeIds?.length)
    q = q.not("id", "in", `(${opts.excludeIds.join(",")})`);

  return q;
}

function shuffle<T>(rows: T[]): T[] {
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

/** Round-robin buckets into one list, preserving category variety. */
function interleave(buckets: Candidate[][], limit: number): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const max = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < max && out.length < limit; i++) {
    for (const b of buckets) {
      const c = b[i];
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

/**
 * SQL-only candidate retrieval (no LLM cost): a category-balanced, in-budget,
 * gender-screened, dislike-excluded pool for the ranker. Each product_type gets
 * its own interest-matched bucket (with a quality fallback), then we round-robin
 * so the final set spans categories rather than collapsing to one.
 */
export async function retrieveCandidates(
  profile: TasteProfile,
  opts: RetrieveOpts = {}
): Promise<Candidate[]> {
  const terms = [...profile.interests, ...profile.brands]
    .map(sanitize)
    .filter(Boolean)
    .slice(0, 20);
  const ors = terms.length
    ? terms
        .flatMap((t) => [`product_name.ilike.%${t}%`, `brand_name.ilike.%${t}%`])
        .join(",")
    : null;

  const buckets = await Promise.all(
    TYPES.map(async (type) => {
      // Interest-matched within this category…
      if (ors) {
        const { data } = await baseQuery(profile, opts)
          .eq("product_type", type)
          .or(ors)
          .limit(PER_TYPE);
        if (data && data.length) return shuffle(data as Candidate[]);
      }
      if (INTEREST_MATCHED_ONLY.has(type)) return [];
      // …else a quality in-budget sample of the category.
      const { data } = await baseQuery(profile, opts)
        .eq("product_type", type)
        .order("sort_key", { ascending: true })
        .limit(PER_TYPE);
      return shuffle((data ?? []) as Candidate[]);
    })
  );

  const mixed = interleave(buckets, CANDIDATE_LIMIT);
  if (mixed.length) return mixed;

  // Last resort: any interest-matched, in-budget items regardless of type.
  const { data } = ors
    ? await baseQuery(profile, opts).or(ors).limit(CANDIDATE_LIMIT)
    : await baseQuery(profile, opts).limit(CANDIDATE_LIMIT);
  return shuffle((data ?? []) as Candidate[]);
}
