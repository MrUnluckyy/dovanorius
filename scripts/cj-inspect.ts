/**
 * Look at our CJ account before importing anything.
 *
 *   pnpm cj:inspect
 *
 * Prints, without writing anything:
 *   1. the advertisers we have joined that publish a product feed (IDs, names,
 *      product counts, countries), which is what CJ_ADVERTISER_IDS takes;
 *   2. the live fields of CJ's Product type, to confirm the names lib/feeds/cj.ts
 *      reads;
 *   3. per advertiser: one page of products, the total CJ reports, how many
 *      pass the country filter, and a raw row next to its mapped result.
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

  console.log("\n== Joined advertisers with a product feed ==");
  const feeds = await listJoinedFeeds(token, companyId);
  for (const f of feeds) {
    console.log(
      `  ${f.advertiserId.padEnd(10)} ${f.advertiserName.padEnd(30)} ${String(f.productCount).padStart(8)} products` +
        `  ${f.advertiserCountry ?? "?"} ${f.language ?? ""} ${f.currency ?? ""}`
    );
  }
  if (!feeds.length) console.log("  (none: check that the programmes are joined and publish feeds)");

  console.log("\n== Product type fields (live schema) ==");
  try {
    const schema = await cjGraphql<{ __type?: { fields?: { name: string }[] } }>(
      token,
      `{ __type(name: "Product") { fields { name } } }`
    );
    console.log("  " + (schema.__type?.fields?.map((f) => f.name).join(", ") ?? "(introspection disabled)"));
  } catch (e) {
    console.log(`  introspection unavailable: ${e instanceof Error ? e.message : e}`);
  }

  for (const f of feeds) {
    console.log(`\n== ${f.advertiserName} (${f.advertiserId}) ==`);
    try {
      const data = await cjGraphql<{
        products?: { totalCount?: number; resultList?: CjProduct[] };
      }>(token, productsQuery(companyId, f.advertiserId, websiteId, 0, 50));
      const rows = data.products?.resultList ?? [];
      const mapped = rows.map((r) => mapProduct(r, tld)).filter(Boolean);
      console.log(`  totalCount ${data.products?.totalCount ?? "?"}; first page ${rows.length}, ${mapped.length} pass (.${tld} link, tracked URL, price)`);
      if (rows[0]) {
        console.log("  raw:    " + JSON.stringify(rows[0]).slice(0, 600));
        console.log("  mapped: " + JSON.stringify(mapProduct(rows[0], tld)));
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
