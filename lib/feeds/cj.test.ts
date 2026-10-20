// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mapProduct, parseCjFeed, productsQuery, joinedQuery, type CjProduct } from "./cj";

const base: CjProduct = {
  id: "SKU-1",
  advertiserId: 5550001,
  advertiserName: "Notino LT",
  title: "Lancôme Idôle kvepalai moterims 50 ml",
  brand: "Lancôme",
  link: "https://www.notino.lt/lancome/idole/",
  imageLink: "https://cdn.notino.com/x.jpg",
  availability: "in stock",
  price: { amount: "89.90", currency: "EUR" },
  salePrice: null,
  productType: ["Kvepalai > Moterims"],
  googleProductCategory: { name: "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne" },
  gender: "female",
  itemGroupId: "G-77",
  linkCode: { clickUrl: "https://www.anrdoezrs.net/click-123-456?url=..." },
};

test("maps a CJ product to our shape, tracked link and namespaced id", () => {
  const p = mapProduct(base, "lt")!;
  assert.equal(p.network, "cj");
  assert.equal(p.id, "cj-5550001-SKU-1");
  assert.equal(p.merchantId, "5550001");
  assert.equal(p.merchantName, "Notino LT");
  assert.equal(p.deepLink, base.linkCode!.clickUrl);
  assert.equal(p.price, 89.9);
  assert.equal(p.rrp, null);
  assert.equal(p.gender, "female");
  assert.equal(p.inStock, true);
  assert.equal(p.conceptKey, "5550001:G-77");
  assert.equal(p.categoryName, "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne > Kvepalai > Moterims");
});

test("category: shop type without Google's, HTML stripped, empty arrays ignored", () => {
  const zepter = mapProduct(
    { ...base, googleProductCategory: null, productType: ["Cookart<sup>&reg;<", "sup> > Healthy cooking"] },
    "lt"
  )!;
  assert.equal(zepter.categoryName, "Cookart");
  assert.equal(mapProduct({ ...base, productType: [] }, "lt")!.categoryName, base.googleProductCategory!.name);
  assert.equal(mapProduct({ ...base, productType: [], googleProductCategory: null }, "lt")!.categoryName, null);
});

test("a sale price below the listed one becomes the price; the listed one the rrp", () => {
  const p = mapProduct({ ...base, salePrice: { amount: "69.90", currency: "EUR" } }, "lt")!;
  assert.equal(p.price, 69.9);
  assert.equal(p.rrp, 89.9);
});

test("skips: no tracked link, other country, no price, no title", () => {
  assert.equal(mapProduct({ ...base, linkCode: null }, "lt"), null);
  assert.equal(mapProduct({ ...base, link: "https://www.notino.lv/lancome/" }, "lt"), null);
  assert.equal(mapProduct({ ...base, price: null, salePrice: null }, "lt"), null);
  assert.equal(mapProduct({ ...base, title: "  " }, "lt"), null);
  // the country filter can be switched off
  assert.ok(mapProduct({ ...base, link: "https://www.notino.lv/x" }, ""));
});

test("stock follows Google availability values", () => {
  assert.equal(mapProduct({ ...base, availability: "out of stock" }, "lt")!.inStock, false);
  assert.equal(mapProduct({ ...base, availability: "in_stock" }, "lt")!.inStock, true);
  assert.equal(mapProduct({ ...base, availability: undefined }, "lt")!.inStock, true);
});

test("parses newline-delimited rows and ignores junk lines", async () => {
  const body = Readable.from([JSON.stringify(base) + "\n", "not json\n", "\n", JSON.stringify({ ...base, id: "SKU-2" }) + "\n"]);
  const out = [];
  for await (const p of parseCjFeed(body, "lt")) out.push(p.id);
  assert.deepEqual(out, ["cj-5550001-SKU-1", "cj-5550001-SKU-2"]);
});

test("queries embed arguments as JSON string literals (no injection, no type guessing)", () => {
  const first = productsQuery('12"34', "999", "777", null);
  assert.ok(first.includes('companyId: "12\\"34"'));
  assert.ok(first.includes('partnerIds: ["999"]'));
  assert.ok(!first.includes("page:"), "no cursor on the first page");
  assert.ok(!first.includes("offset"), "offset paging stops at 10k, never use it");
  assert.ok(first.includes('linkCode(pid: "777")'));
  assert.ok(first.includes("... on Shopping"));
  assert.ok(productsQuery("1", "2", "3", "abc==").includes('page: "abc=="'));
  assert.ok(joinedQuery("1", ["5", "6"]).includes('partnerStatus: JOINED, excludePartnerIds: ["5", "6"]'));
  assert.ok(joinedQuery("1", []).includes("excludePartnerIds: []"));
});

test("known shops get our display name and, for single-brand shops, a default brand", () => {
  const philips = mapProduct({ ...base, advertiserId: "7336769", advertiserName: "Philips Baltics", brand: null }, "lt")!;
  assert.equal(philips.merchantName, "Philips LT");
  assert.equal(philips.brandName, "Philips");
  const notino = mapProduct({ ...base, advertiserId: "5835258", brand: null }, "lt")!;
  assert.equal(notino.brandName, null, "multi-brand shops get no guessed brand");
});
