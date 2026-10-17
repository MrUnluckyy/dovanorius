// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBandFromDob, resolveVisitor, vocative } from "./visitorState";
import { recipientLens } from "./recipients";

const NOW = new Date("2026-10-17T12:00:00Z");

test("age bands, birthday not yet reached counts the year before", () => {
  assert.equal(ageBandFromDob("2010-01-01", NOW), null); // 16
  assert.equal(ageBandFromDob("2002-10-18", NOW), "18-24"); // 23, birthday tomorrow
  assert.equal(ageBandFromDob("2001-10-17", NOW), "25-34"); // 25 today
  assert.equal(ageBandFromDob("1988-03-01", NOW), "35-44");
  assert.equal(ageBandFromDob("1960-01-01", NOW), "55+");
  assert.equal(ageBandFromDob("not a date", NOW), null);
});

test("vocative covers common Lithuanian endings, leaves the rest", () => {
  assert.equal(vocative("Ugnė"), "Ugne");
  assert.equal(vocative("Justas"), "Justai");
  assert.equal(vocative("Paulius"), "Pauliau");
  assert.equal(vocative("Algis"), "Algi");
  assert.equal(vocative("Rasa"), "Rasa");
  assert.equal(vocative("John"), "John");
});

const profile = (p: Partial<Parameters<typeof resolveVisitor>[0] & object>) => ({
  display_name: null,
  gender: null,
  date_of_birth: null,
  last_recipient: null,
  ...p,
});

test("state 1: no session, or no gender — tiles, nothing preselected", () => {
  assert.deepEqual(
    { ...resolveVisitor(null, false) },
    { state: "1", greetingName: null, gender: null, ageBand: null, recipient: null, isAccount: false }
  );
  assert.equal(resolveVisitor(profile({ date_of_birth: "1990-01-01" }), true).state, "1");
});

test("state 2 and 3 open on Sau, greet accounts by vocative", () => {
  const v2 = resolveVisitor(profile({ display_name: "Ugnė Petraitė", gender: "female" }), true);
  assert.equal(v2.state, "2");
  assert.equal(v2.recipient, "self");
  assert.equal(v2.greetingName, "Ugne");

  const v3 = resolveVisitor(profile({ gender: "male", date_of_birth: "1988-03-01" }), true);
  assert.equal(v3.state, "3");
});

test("last_recipient beats the Sau default; junk values are ignored", () => {
  assert.equal(resolveVisitor(profile({ gender: "female", last_recipient: "kid" }), true).recipient, "kid");
  assert.equal(resolveVisitor(profile({ gender: "female", last_recipient: "nope" }), true).recipient, "self");
});

test("guests are never greeted by name", () => {
  assert.equal(resolveVisitor(profile({ display_name: "Ugnė", gender: "female" }), false).greetingName, null);
});

test("recipient lens", () => {
  assert.deepEqual(recipientLens("self", "female"), { audience: "her", personas: ["woman-30plus"], gridType: null });
  assert.deepEqual(recipientLens("self", null), { audience: "everyone", personas: [], gridType: null });
  assert.deepEqual(recipientLens("partner", "female"), { audience: "everyone", personas: [], gridType: null });
  assert.deepEqual(recipientLens("partner", "female", "male"), { audience: "him", personas: ["man-30plus"], gridType: null });
  assert.equal(recipientLens("kid", "male").gridType, "toys");
  assert.deepEqual(recipientLens("teen", null).personas, ["teen-girl", "teen-boy"]);
});
