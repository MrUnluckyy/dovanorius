/**
 * Runs real saved product links through a deployed parser and prints what
 * each shop gives back, so parser changes can be measured, not guessed.
 *
 *   pnpm tsx scripts/parser-check.ts                      # production
 *   pnpm tsx scripts/parser-check.ts http://localhost:3000
 *
 * Statuses: OK (title + image + price), THIN (missing image or price),
 * FEED (answered from our product feeds), PARTIAL (blocked; title from link),
 * or the error code. URLs: scripts/parser-urls.txt (one real link per shop,
 * from items.url; refresh it now and then).
 *
 * Run it from a server-like network to see what production sees: from a home
 * IP, shops that block datacenters pass, and Shopify may 429 repeated runs.
 */
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "https://www.noriuto.lt";
const urls = readFileSync(new URL("./parser-urls.txt", import.meta.url), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

type Row = { host: string; status: string; title: string };

async function check(url: string): Promise<Row> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  try {
    const res = await fetch(`${base}/api/parser?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(45_000),
    });
    const d = await res.json().catch(() => ({}));
    if (d.error) return { host, status: String(d.error), title: "" };
    const status =
      d.source === "feed" ? "FEED"
      : d.partial ? `PARTIAL(${d.reason})`
      : d.images?.length && d.price ? "OK"
      : "THIN";
    return { host, status, title: String(d.title ?? "").slice(0, 50) };
  } catch (e) {
    return { host, status: `EXC ${String(e).slice(0, 30)}`, title: "" };
  }
}

async function main() {
  const rows: Row[] = [];
  // A few at a time: this hits real shops.
  for (let i = 0; i < urls.length; i += 5) {
    rows.push(...(await Promise.all(urls.slice(i, i + 5).map(check))));
  }
  for (const r of rows) console.log(`${r.host.padEnd(24)} ${r.status.padEnd(22)} ${r.title}`);
  const tally = new Map<string, number>();
  for (const r of rows) {
    const k = r.status.replace(/\(.*\)/, "");
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  console.log(`\n${base} — ${rows.length} shops:`, Object.fromEntries(tally));
}

main();
