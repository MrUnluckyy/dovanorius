import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShopUrl, wishOutHref } from "../utils/affiliate/outHref";
import { ItemSchema } from "../schemas/ItemSchema";

test("keeps absolute http(s) URLs", () => {
  assert.equal(normalizeShopUrl("https://www.knygos.lt/lt/knygos/x/"), "https://www.knygos.lt/lt/knygos/x/");
  assert.equal(normalizeShopUrl("  http://shop.lt/a?b=1  "), "http://shop.lt/a?b=1");
});

test("adds https:// to scheme-less links and bare domains", () => {
  assert.equal(normalizeShopUrl("www.google.lt"), "https://www.google.lt/");
  assert.equal(normalizeShopUrl("elumi.lt"), "https://elumi.lt/");
  assert.equal(normalizeShopUrl("www.senukai.lt/p/item-123?x=1"), "https://www.senukai.lt/p/item-123?x=1");
});

test("rejects things that are not links", () => {
  for (const bad of [
    "",
    "   ",
    "kazkur",
    "ma",
    "Hopcover",
    "Galima.pirkti.Akropolyje",
    "EUROKOS blakstienų serumas.",
    "https://Termo apatiniai",
    "/adidas-originals-flower-tee.html",
    "javascript:alert(1)",
    "data:text/html,hi",
    "noriu",
    "noriu.",
    "noriu.l",
    "https://noriu",
    "https://noriu.",
    "https://noriu.l",
    "https://.lt",
    "https://noriu..lt",
    "http://localhost",
    "https://192.168.1.1",
    "https://user:pass@shop.lt",
    "noriu .lt",
    "ftp://shop.lt",
  ]) {
    assert.equal(normalizeShopUrl(bad), null, bad);
  }
});

test("unwraps our own /out links", () => {
  const inner = "https://www.shop.lt/p/1";
  const wrapped = `https://www.noriuto.lt/out?u=${encodeURIComponent(inner)}`;
  assert.equal(normalizeShopUrl(wrapped), inner);
});

test("wishOutHref returns null for unusable links", () => {
  assert.equal(wishOutHref({ id: "1", url: "kazkur" }), null);
  assert.equal(
    wishOutHref({ id: "1", url: "www.shop.lt/a" }),
    `/out?u=${encodeURIComponent("https://www.shop.lt/a")}&item=1`
  );
});

test("keeps real shop hosts, including long and Lithuanian domains", () => {
  assert.equal(normalizeShopUrl("https://shop.photography/x"), "https://shop.photography/x");
  assert.ok(normalizeShopUrl("https://žalgiris.lt/"));
  assert.equal(normalizeShopUrl("www.shop.lt:8080/a"), "https://www.shop.lt:8080/a");
});

test("saving a wish rejects broken links and normalises good ones", () => {
  const url = ItemSchema.shape.url;
  for (const bad of ["noriu", "noriu.", "noriu.l", "https://noriu", "https://noriu.l", "kazkur"]) {
    assert.equal(url.safeParse(bad).success, false, bad);
  }
  assert.equal(url.parse(""), "");
  assert.equal(url.parse(" www.knygos.lt/x "), "https://www.knygos.lt/x");
});
