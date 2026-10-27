// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECIPIENT_SLUGS,
  categoriesFor,
  categoryFromSlug,
  discoverHref,
  recipientFromSlug,
} from "./routes";
import { cleanName, formatPrice } from "./format";

test("every recipient slug round-trips", () => {
  for (const [key, slug] of Object.entries(RECIPIENT_SLUGS)) {
    assert.equal(recipientFromSlug(slug), key);
  }
  assert.equal(recipientFromSlug("nope"), null);
});

test("hrefs are Lithuanian and nest category under recipient", () => {
  assert.equal(discoverHref(null), "/idejos");
  assert.equal(discoverHref("woman"), "/idejos/moteriai");
  assert.equal(discoverHref("kid", "toys"), "/idejos/vaikui/zaislai");
  assert.equal(discoverHref("woman", "unknown"), "/idejos/moteriai");
  assert.equal(categoryFromSlug("grozis"), "beauty");
});

test("children's pages offer no adult categories", () => {
  for (const r of ["kid", "baby"] as const) {
    assert.ok(!categoriesFor(r, null).includes("home"));
    assert.ok(!categoriesFor(r, null).includes("beauty"));
  }
  // apparel comes last for adults, so tiles lead with packshot categories
  assert.deepEqual(categoriesFor("woman", null).slice(-3), ["bag", "clothing", "shoes"]);
});

test("names lose the repeated brand and feed noise", () => {
  assert.equal(cleanName("Armani - My Way Parfum Kvepalai 30 ml female", "Armani"), "My Way Parfum Kvepalai 30 ml");
  assert.equal(cleanName("Sisley - Candle Campagne Žvakės 220 g unisex", "Sisley"), "Candle Campagne Žvakės 220 g");
  assert.equal(cleanName("Arena Tech Deck Shredline, uniwersalny", null), "Arena Tech Deck Shredline");
  assert.equal(cleanName("Puodelis", "Red Tuxedo"), "Puodelis");
});

test("prices are formatted the Lithuanian way", () => {
  assert.equal(formatPrice(23.9).replace(/\s/g, " "), "23,90 €");
  assert.equal(formatPrice(null), "");
});
