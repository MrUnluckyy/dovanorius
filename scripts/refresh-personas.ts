/**
 * Re-curate persona shelves that need it.
 *
 *   pnpm tsx scripts/refresh-personas.ts             # only shelves that decayed
 *   pnpm tsx scripts/refresh-personas.ts --all       # force every active persona
 *   pnpm tsx scripts/refresh-personas.ts man-30plus  # just these slugs
 *   pnpm tsx scripts/refresh-personas.ts --dry-run   # list what would run, spend $0
 *
 * Weekly is plenty: a persona is identical for every visitor, so one pass
 * serves everyone until the catalogue moves under it. Cost is one LLM call per
 * persona (cents), and the page rotates its picks daily from the stored set
 * without calling the model again.
 *
 * INCREMENTAL BY DEFAULT. This used to rebuild all 17 shelves every Monday at
 * roughly $2.62 a run, which paid the model to re-pick products that were still
 * perfectly good. What actually erodes a shelf is the catalogue moving beneath
 * it: persona_products cascades on inspo_products deletion, so a merchant
 * delisting stock silently drains picks -- on 2026-08-12 Pigu's feed went from
 * ~95k products to 16,868 and took eight shelves to zero in one import.
 *
 * So the trigger is decay, not the calendar. A shelf with plenty of in-stock
 * picks is skipped and costs nothing; a drained one is rebuilt. Same weekly
 * cron, a fraction of the spend, and it now reacts to the thing that actually
 * breaks shelves instead of to the day of the week.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SECRET_KEY,
 * ANTHROPIC_API_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { refreshPersona, type Persona } from "../lib/personas/refresh";

/**
 * In-stock picks at or above which a shelf is left alone.
 *
 * SHELF_SIZE is 12 (hooks/usePersonas.ts) and PersonaShelf hides a shelf under
 * 4, so 14 keeps a full first screen plus headroom to lose a couple of products
 * before the next run without the shelf ever looking short.
 */
const HEALTHY_PICKS = 14;

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Persona ids with enough in-stock picks that rebuilding them buys nothing. */
async function healthyPersonaIds(
  supabase: ReturnType<typeof makeClient>
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("persona_shelf_health");
  if (error) throw new Error(`persona_shelf_health: ${error.message}`);

  const rows = (data ?? []) as {
    persona_id: string;
    slug: string;
    in_stock_picks: number;
  }[];

  return new Set(
    rows.filter((r) => r.in_stock_picks >= HEALTHY_PICKS).map((r) => r.persona_id)
  );
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith("--"));
  const forceAll = args.includes("--all");
  // Lets the selection be checked without paying for it — otherwise the first
  // real exercise of the incremental path is a live cron run.
  const dryRun = args.includes("--dry-run");
  const supabase = makeClient();

  let query = supabase
    .from("gift_personas")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (only.length) query = query.in("slug", only);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let personas = (data ?? []) as Persona[];
  if (!personas.length) {
    console.log("no active personas matched");
    return;
  }

  // Naming slugs explicitly, or --all, means "do it regardless of health".
  if (!only.length && !forceAll) {
    const healthy = await healthyPersonaIds(supabase);
    const before = personas.length;
    personas = personas.filter((p) => !healthy.has(p.id));
    const skipped = before - personas.length;
    if (skipped) {
      console.log(
        `skipping ${skipped} shelf(s) already at ${HEALTHY_PICKS}+ in-stock picks ` +
          `(--all to force)`
      );
    }
    if (!personas.length) {
      console.log("every shelf is healthy — nothing to re-curate, $0 spent");
      return;
    }
  }

  if (dryRun) {
    console.log(`would re-curate ${personas.length} shelf(s):`);
    for (const p of personas) console.log(`  ${p.slug}`);
    console.log("(--dry-run: nothing called, $0 spent)");
    return;
  }

  // Checked here rather than at entry so --dry-run works without the key.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
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
