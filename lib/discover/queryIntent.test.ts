// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGiftQuery, stripPrice } from "./queryIntent";

test("a recipient phrase is a page, not a search", () => {
  assert.deepEqual(parseGiftQuery("dovana mamai"), { q: "", priceMax: null, recipient: "mom", occasion: null });
  assert.deepEqual(parseGiftQuery("dovanų idėjos vyrui"), { q: "", priceMax: null, recipient: "man", occasion: null });
  assert.deepEqual(parseGiftQuery("kalėdinė dovana tėčiui iki 50€"), { q: "", priceMax: 50, recipient: "man", occasion: "christmas" });
});

test("a budget becomes a price filter and the product words stay", () => {
  assert.deepEqual(parseGiftQuery("kvepalai iki 30 eur"), { q: "kvepalai", priceMax: 30, recipient: null, occasion: null });
  assert.deepEqual(parseGiftQuery("ausinės vaikui"), { q: "ausinės", priceMax: null, recipient: "kid", occasion: null });
});

test("ordinary searches are left alone", () => {
  assert.deepEqual(parseGiftQuery("lego"), { q: "lego", priceMax: null, recipient: null, occasion: null });
  // "dovanos" on its own is still a search, and "iki 20m2" is not a budget.
  assert.equal(parseGiftQuery("dovanos").q, "dovanos");
  assert.equal(parseGiftQuery("iki 20m2 sildytuvas").priceMax, null);
  assert.equal(parseGiftQuery("kalėdinis žaislas").q, "kalėdinis žaislas");
});

test("stripPrice removes only the budget", () => {
  assert.equal(stripPrice("kvepalai iki 30 eur"), "kvepalai");
});

test("an occasion phrase is the occasion page; an occasion product is a search", () => {
  assert.deepEqual(parseGiftQuery("kalėdinės dovanos"), { q: "", priceMax: null, recipient: null, occasion: "christmas" });
  assert.deepEqual(parseGiftQuery("secret santa iki 20 eur"), { q: "", priceMax: 20, recipient: null, occasion: "secretSanta" });
  assert.deepEqual(parseGiftQuery("dovana gimtadieniui"), { q: "", priceMax: null, recipient: null, occasion: "birthday" });
  const ornament = parseGiftQuery("kalėdinis žaislas");
  assert.equal(ornament.q, "kalėdinis žaislas");
  assert.equal(ornament.occasion, "christmas");
});
