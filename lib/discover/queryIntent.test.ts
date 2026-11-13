// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGiftQuery, stripPrice } from "./queryIntent";

test("a recipient phrase is a page, not a search", () => {
  assert.deepEqual(parseGiftQuery("dovana mamai"), { q: "", priceMax: null, recipient: "mom" });
  assert.deepEqual(parseGiftQuery("dovanų idėjos vyrui"), { q: "", priceMax: null, recipient: "man" });
  assert.deepEqual(parseGiftQuery("kalėdinė dovana tėčiui iki 50€"), { q: "", priceMax: 50, recipient: "man" });
});

test("a budget becomes a price filter and the product words stay", () => {
  assert.deepEqual(parseGiftQuery("kvepalai iki 30 eur"), { q: "kvepalai", priceMax: 30, recipient: null });
  assert.deepEqual(parseGiftQuery("ausinės vaikui"), { q: "ausinės", priceMax: null, recipient: "kid" });
});

test("ordinary searches are left alone", () => {
  assert.deepEqual(parseGiftQuery("lego"), { q: "lego", priceMax: null, recipient: null });
  // "dovanos" on its own is still a search, and "iki 20m2" is not a budget.
  assert.equal(parseGiftQuery("dovanos").q, "dovanos");
  assert.equal(parseGiftQuery("iki 20m2 sildytuvas").priceMax, null);
  assert.equal(parseGiftQuery("kalėdinis žaislas").q, "kalėdinis žaislas");
});

test("stripPrice removes only the budget", () => {
  assert.equal(stripPrice("kvepalai iki 30 eur"), "kvepalai");
});
