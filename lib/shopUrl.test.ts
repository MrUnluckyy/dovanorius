import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShopUrl, wishOutHref } from "../utils/affiliate/outHref";

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
