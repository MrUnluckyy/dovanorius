import { test } from "node:test";
import assert from "node:assert/strict";
import { redactPayload, redactSecrets } from "./analyticsRedact";

const SECRET = "pkce_0123456789abcdef";

test("removes the auth token from a confirmation link", () => {
  const url = `https://example.com/auth/confirm?token_hash=${SECRET}&type=recovery&next=%2F`;
  const out = redactSecrets(url);
  assert.ok(!out.includes(SECRET));
  assert.equal(out, "https://example.com/auth/confirm?token_hash=redacted&type=recovery&next=%2F");
});

test("removes tokens from relative URLs, later parameters and the fragment", () => {
  assert.equal(redactSecrets(`/auth/confirm?type=email&token_hash=${SECRET}`), "/auth/confirm?type=email&token_hash=redacted");
  assert.equal(redactSecrets(`/api/auth/callback?code=${SECRET}`), "/api/auth/callback?code=redacted");
  assert.equal(
    redactSecrets(`/naujas-slaptazodis#access_token=${SECRET}&refresh_token=${SECRET}&type=recovery`),
    "/naujas-slaptazodis#access_token=redacted&refresh_token=redacted&type=recovery"
  );
});

test("keeps URLs without secrets as they are", () => {
  for (const url of [
    "/auth/confirm?type=email&next=%2F",
    "/idejos/visos?q=kodas&price=10&sort=new",
    "/renginiai/kaledos?invite=1",
    "/b/s/abc?tokenx=1&mytoken=2",
  ]) {
    assert.equal(redactSecrets(url), url);
  }
});

test("removes tokens from every part of an event", () => {
  const confirmUrl = `https://example.com/auth/confirm?token_hash=${SECRET}&type=email`;
  const event = {
    uuid: "u1",
    event: "$autocapture",
    timestamp: new Date(0),
    properties: {
      $current_url: confirmUrl,
      $referrer: confirmUrl,
      $session_entry_url: confirmUrl,
      $elements_chain: `a:attr__href="/auth/confirm?token_hash=${SECRET}"nth-child="1"`,
      $elements: [{ attr__href: `/auth/confirm?token_hash=${SECRET}` }],
      count: 3,
      ok: true,
      none: null,
    },
    $set_once: { $initial_current_url: confirmUrl },
  };
  const out = redactPayload(event);
  assert.ok(!JSON.stringify(out).includes(SECRET));
  assert.equal(out.properties.$elements_chain, 'a:attr__href="/auth/confirm?token_hash=redacted"nth-child="1"');
  assert.equal(out.properties.count, 3);
  assert.equal(out.properties.ok, true);
  assert.equal(out.properties.none, null);
  assert.ok(out.timestamp instanceof Date);
  assert.ok(JSON.stringify(event).includes(SECRET), "the input is not changed");
});
