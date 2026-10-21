// pnpm test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { dative, firstName, genitive } from "./ltName";

test("dative", () => {
  for (const [n, d] of [
    ["Tomas", "Tomui"], ["Jonas", "Jonui"], ["Rūta", "Rūtai"], ["Ugnė", "Ugnei"],
    ["Paulius", "Pauliui"], ["Kęstutis", "Kęstučiui"], ["Algirdas", "Algirdui"],
    ["Gytis", "Gyčiui"], ["Vaidis", "Vaidžiui"], ["Linas", "Linui"], ["Mykolas", "Mykolui"],
  ] as const) assert.equal(dative(n), d, n);
});

test("genitive", () => {
  for (const [n, g] of [
    ["Tomas", "Tomo"], ["Rūta", "Rūtos"], ["Ugnė", "Ugnės"], ["Paulius", "Pauliaus"],
    ["Kęstutis", "Kęstučio"], ["Algis", "Algio"], ["Matas", "Mato"],
  ] as const) assert.equal(genitive(n), g, n);
});

test("unknown endings fall back to null, never a guess", () => {
  assert.equal(dative("John"), null);
  assert.equal(genitive("Mantė"), "Mantės");
  assert.equal(genitive("Tom"), null);
});

test("first name", () => {
  assert.equal(firstName("Ugnė Petraitė"), "Ugnė");
  assert.equal(firstName("  "), null);
  assert.equal(firstName("J"), null);
  assert.equal(firstName(null), null);
});
