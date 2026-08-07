/**
 * Re-curate every persona shelf.
 *
 *   pnpm tsx scripts/refresh-personas.ts             # all active personas
 *   pnpm tsx scripts/refresh-personas.ts man-30plus  # just these slugs
 *
 * Weekly is plenty: a persona is identical for every visitor, so one pass
 * serves everyone until the catalogue moves under it. Cost is one LLM call per
 * persona (cents), and the page rotates its picks daily from the stored set
 * without calling the model again.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SECRET_KEY,
 * ANTHROPIC_API_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { refreshPersona, type Persona } from "../lib/personas/refresh";

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const supabase = makeClient();

  let query = supabase
    .from("gift_personas")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (only.length) query = query.in("slug", only);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const personas = (data ?? []) as Persona[];
  if (!personas.length) {
    console.log("no active personas matched");
    return;
  }

  let totalCost = 0;
  let failed = false;

  for (const persona of personas) {
    const started = Date.now();
    try {
      const r = await refreshPersona(supabase, persona);
      totalCost += r.costUsd;
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(
        `✓ ${r.slug}: ${r.kept}/${r.candidates} kept · $${r.costUsd.toFixed(4)} · ${secs}s`
      );
      if (r.kept < 10) {
        // Not fatal, but a shelf this thin will visibly repeat — usually the
        // persona's product_types are too narrow for the catalogue.
        console.warn(`  ⚠ ${r.slug} only kept ${r.kept}; widen its rules`);
      }
    } catch (e) {
      failed = true;
      console.error(`✗ ${persona.slug}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`total: $${totalCost.toFixed(4)} across ${personas.length} persona(s)`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
