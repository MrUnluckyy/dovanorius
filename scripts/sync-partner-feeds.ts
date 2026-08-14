/**
 * Daily partner catalogue sync.
 *
 *   pnpm sync:partners                    # every partner with feed_enabled
 *   pnpm sync:partners <partner-slug>     # just one, for debugging
 *
 * Runs nightly via .github/workflows/sync-partner-feeds.yml, or locally with
 * the service-role env vars set.
 *
 * Failure handling: one broken store must not stop the others, so every
 * partner is attempted and failures are collected. The process then exits 1 if
 * anything failed, which turns the Action red and triggers GitHub's
 * notification. Per-partner detail is also persisted to
 * partners.feed_last_status / feed_last_error, which the admin table surfaces.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
 *   SUPABASE_SECRET_KEY        service-role key (bypasses RLS; needed to write
 *                              status='approved' for auto-approved feeds)
 */
import { createClient } from "@supabase/supabase-js";
import { syncPartnerFeed } from "../lib/partner-feeds/sync";

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Appended to the GitHub Actions run summary when available. */
function summary(lines: string[]) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    fs.appendFileSync(file, lines.join("\n") + "\n");
  } catch {
    /* summary is best-effort */
  }
}

async function main() {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const supabase = makeClient();

  let query = supabase
    .from("partners")
    .select("id, name, slug, store_domain, feed_platform")
    .eq("feed_enabled", true)
    .eq("is_active", true)
    .not("store_domain", "is", null);

  if (slug) query = query.eq("slug", slug);

  const { data: partners, error } = await query;
  if (error) throw new Error(`Failed to list partners: ${error.message}`);

  if (!partners?.length) {
    console.log("No partners with an enabled feed. Nothing to do.");
    summary(["### Partner feed sync", "", "No partners with an enabled feed."]);
    return;
  }

  console.log(`Syncing ${partners.length} partner feed(s)…`);
  const rows: string[] = [];
  const failures: { name: string; message: string }[] = [];

  for (const p of partners) {
    const label = `${p.name} (${p.store_domain}, ${p.feed_platform})`;
    try {
      const r = await syncPartnerFeed(supabase, p.id);
      console.log(
        `  ok    ${label}: fetched ${r.fetched}, imported ${r.written}, ` +
          `skipped sold-out ${r.skippedSoldOut}, deactivated ${r.deactivated}` +
          `${r.autoApproved ? "" : " (pending moderation)"}`
      );
      rows.push(
        `| ✅ | ${p.name} | ${r.fetched} | ${r.written} | ${r.skippedSoldOut} | ${r.deactivated} |`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Keep going: a partner whose store moved must not block the rest.
      console.error(`  FAIL  ${label}: ${message}`);
      failures.push({ name: p.name, message });
      rows.push(`| ❌ | ${p.name} | — | — | — | ${message} |`);
    }
  }

  summary([
    "### Partner feed sync",
    "",
    "| | Partner | Fetched | Imported | Skipped sold-out | Deactivated / error |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...rows,
  ]);

  if (failures.length) {
    console.error(
      `\n${failures.length} of ${partners.length} partner feed(s) failed:`
    );
    for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
    // Non-zero exit => red Action run => GitHub notifies on the failure.
    process.exit(1);
  }

  console.log(`\nAll ${partners.length} partner feed(s) synced.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
