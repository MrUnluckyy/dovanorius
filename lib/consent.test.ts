import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_VERSION,
  consentDefaultsScript,
  consentModeSignals,
  parseConsent,
  serializeConsent,
} from "./consent";

test("a stored choice round-trips", () => {
  const c = { analytics: true, marketing: false, at: 1793900000 };
  assert.deepEqual(parseConsent(serializeConsent(c)), c);
});

test("no choice, an older version or junk all mean: ask", () => {
  assert.equal(parseConsent(undefined), null);
  assert.equal(parseConsent(""), null);
  assert.equal(parseConsent(`v${CONSENT_VERSION + 1}.a1.m1.1`), null);
  assert.equal(parseConsent(`v${CONSENT_VERSION - 1}.a1.m1.1`), null);
  assert.equal(parseConsent("v1.a2.m0.1"), null);
  assert.equal(parseConsent("yes"), null);
});

test("nothing is granted until chosen", () => {
  assert.deepEqual(consentModeSignals(null), {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  const script = consentDefaultsScript(null);
  assert.match(script, /gtag\('consent','default'/);
  assert.doesNotMatch(script, /'update'/);
  assert.doesNotMatch(script, /"granted"[^}]*analytics_storage|analytics_storage":"granted/);
});

test("a returning visitor's choice applies before GTM loads", () => {
  const script = consentDefaultsScript({ analytics: true, marketing: false, at: 1 });
  assert.match(script, /'update',\{"analytics_storage":"granted","ad_storage":"denied"/);
  // Default first, update second.
  assert.ok(script.indexOf("'default'") < script.indexOf("'update'"));
});
