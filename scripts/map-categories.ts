/**
 * Map every merchant category string to one of our product_type buckets.
 *
 *   pnpm tsx scripts/map-categories.ts            # only unmapped categories
 *   pnpm tsx scripts/map-categories.ts --all      # re-map everything
 *
 * Why this exists: 76% of the catalogue carries a real merchant taxonomy —
 * Pigu's "žaislai ir zaidimai vaikams", About You's "Moterims - Drabužiai -
 * Striukės" — and classifying from product titles instead is what produced every
 * substring bug (a laptop BAG reading as tech, a LEGO t-shirt as a toy, a boot
 * named "Monitor" as a gadget). The merchant already knows; this records the
 * answer once so the trigger can just look it up.
 *
 * One pass over ~2,250 strings costs a few cents. Rows are editable afterwards:
 * fix a mapping in the table and re-derive, no deploy and no model involved.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { GIFT_MODEL } from "../lib/gifts/config";
import { usdCost } from "../lib/gifts/cost";

const TYPES = [
  "beauty", "shoes", "bag", "clothing", "toys", "tech", "kitchen",
  "tools", "sport", "pets", "garden", "home", "accessory", "other",
] as const;

/** Categories per request. Small enough to stay well inside max_tokens. */
const CHUNK = 120;

const MappingSchema = z.object({
  mappings: z.array(
    z.object({
      category: z.string(),
      type: z.enum(TYPES),
    })
  ),
});

const SYSTEM = `You map e-commerce category paths to a fixed set of product buckets for a Lithuanian gift site.

Buckets: ${TYPES.join(", ")}

Rules:
- Answer for the LEAF of the path — "Moterims > Drabužiai > Striukės" is clothing, not a gender.
- Categories are mostly Lithuanian, some English or Polish. "Žaislai" = toys, "Avalynė" = shoes, "Rankinės" = bags, "Kvepalai" = beauty, "Įrankiai" = tools, "Baldai" = furniture (use other), "Buitinė technika" = appliances (use tech).
- Use "accessory" for jewellery, watches, belts, scarves, sunglasses and hats.
- Use "home" for decor, candles, textiles and lighting; "kitchen" for cookware, tableware, coffee and tea.
- Use "other" ONLY when nothing fits — furniture, car parts, building materials, groceries.
- Return one mapping per input category, using the category string EXACTLY as given.`;

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const remapAll = process.argv.includes("--all");
  const supabase = makeClient();

  // Distinct categories, busiest first, so a partial run still covers the most
  // rows. Aggregated in the DB on purpose: pulling the raw column and grouping
  // here hit PostgREST's 1,000-row default and silently mapped 276 of 2,252
  // categories while reporting success.
  // Paged explicitly: PostgREST caps responses at 1,000 rows on this project and
  // .range() does not lift it, so three earlier runs each reported success while
  // seeing only the first 1,000 of 2,252 categories.
  const counts = new Map<string, number>();
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await supabase.rpc("distinct_categories", {
      p_limit: 1000,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const batch = (page ?? []) as { category_name: string; rows: number }[];
    for (const r of batch) counts.set(r.category_name, Number(r.rows));
    if (batch.length < 1000) break;
  }

  // Skip bare ids. Modivo publishes numeric category IDs ("187", "212") rather
  // than names; the model cannot read a meaning into a number and answers
  // "other", which then outranks the title regex and misfiles tens of thousands
  // of rows. A number is treated as no category at all.
  let categories = [...counts.keys()].filter((c) => !/^[0-9]+$/.test(c));

  if (!remapAll) {
    const { data: existing } = await supabase.from("category_map").select("category_name");
    const known = new Set((existing ?? []).map((e) => e.category_name as string));
    categories = categories.filter((c) => !known.has(c));
  }

  if (!categories.length) {
    console.log("nothing to map");
    return;
  }
  console.log(`mapping ${categories.length} categories (${counts.size} distinct total)`);

  const client = new Anthropic();
  let cost = 0;
  let written = 0;

  for (let i = 0; i < categories.length; i += CHUNK) {
    const chunk = categories.slice(i, i + CHUNK);
    const res = await client.messages.parse({
      model: GIFT_MODEL,
      max_tokens: 8000,
      thinking: { type: "disabled" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ categories: chunk }) }],
      output_config: { format: zodOutputFormat(MappingSchema) },
    });
    cost += usdCost(GIFT_MODEL, res.usage);

    // Only accept categories we actually asked about — a hallucinated string
    // would create a row that never matches anything and quietly rot.
    const asked = new Set(chunk);
    const mappings = (res.parsed_output?.mappings ?? []).filter((m) =>
      asked.has(m.category)
    );

    if (mappings.length) {
      const { error: upErr } = await supabase.from("category_map").upsert(
        mappings.map((m) => ({
          category_name: m.category,
          product_type: m.type,
          note: `auto-mapped ${new Date().toISOString().slice(0, 10)}`,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "category_name" }
      );
      if (upErr) throw new Error(`upsert: ${upErr.message}`);
      written += mappings.length;
    }

    const rowsCovered = chunk.reduce((n, c) => n + (counts.get(c) ?? 0), 0);
    console.log(
      `  ${Math.min(i + CHUNK, categories.length)}/${categories.length} · ` +
        `${mappings.length}/${chunk.length} mapped · ${rowsCovered} rows · $${cost.toFixed(4)}`
    );
  }

  console.log(`done: ${written} categories mapped, $${cost.toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
