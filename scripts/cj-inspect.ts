/**
 * Look at our CJ account before importing anything.
 *
 *   pnpm cj:inspect
 *
 * Prints, without writing anything:
 *   1. the advertisers we have joined (IDs, names, product counts across all
 *      countries), which is what CJ_ADVERTISER_IDS takes;
 *   2. per advertiser: one page of products, how many pass the country filter,
 *      and a raw row next to its mapped result.
 *
 * Env: CJ_ACCESS_TOKEN, CJ_COMPANY_ID, CJ_WEBSITE_ID (see lib/feeds/cj.ts).
 */
import { cjGraphql, listJoinedFeeds, mapProduct, productsQuery, type CjProduct } from "../lib/feeds/cj";

async function main() {
  const token = process.env.CJ_ACCESS_TOKEN?.trim();
  const companyId = process.env.CJ_COMPANY_ID?.trim();
  const websiteId = process.env.CJ_WEBSITE_ID?.trim();
  const tld = (process.env.CJ_COUNTRY_TLD ?? "lt").trim().toLowerCase();
  if (!token || !companyId || !websiteId) {
    throw new Error("Set CJ_ACCESS_TOKEN, CJ_COMPANY_ID and CJ_WEBSITE_ID first");
  }

  console.log("\n== Joined advertisers ==");
  const feeds = await listJoinedFeeds(token, companyId);
  for (const f of feeds) {
    console.log(`  ${f.advertiserId.padEnd(10)} ${f.advertiserName.padEnd(30)} ${String(f.productCount).padStart(8)} products`);
  }
  if (!feeds.length) console.log("  (none: check that the programmes are joined in CJ)");

  for (const f of feeds) {
    console.log(`\n== ${f.advertiserName} (${f.advertiserId}) ==`);
    try {
      const data = await cjGraphql<{
        products?: { totalCount?: number; resultList?: CjProduct[] };
      }>(token, productsQuery(companyId, f.advertiserId, websiteId, null, 200));
      const rows = data.products?.resultList ?? [];
      const mapped = rows.map((r) => mapProduct(r, tld)).filter(Boolean);
      console.log(`  totalCount ${data.products?.totalCount ?? "?"}; first ${rows.length}: ${mapped.length} pass (.${tld} link, tracked URL, price)`);
      const sample = rows.find((r) => mapProduct(r, tld)) ?? rows[0];
      if (sample) {
        console.log("  raw:    " + JSON.stringify(sample).slice(0, 600));
        console.log("  mapped: " + JSON.stringify(mapProduct(sample, tld)));
      }
    } catch (e) {
      console.log(`  failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
