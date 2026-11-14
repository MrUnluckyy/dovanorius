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
    "/b/kaledos?tokenx=1&mytoken=2",
    "/prisijungti?next=%2Fmano",
    "/lentos/abc-123",
    "/renginiai/kaledos/mano",
    "/idejos/join/x",
    "/blog/r/keep/x",
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

const TOKEN = "3f2c9a1e-7b4d-4c8e-9a6f-0123456789ab";

test("replaces the token in every capability link with a placeholder", () => {
  const cases: [string, string][] = [
    [`/b/s/${TOKEN}`, "/b/s/[token]"],
    [`/r/keep/${TOKEN}.c2ln`, "/r/keep/[token]"],
    [`/r/release/${TOKEN}`, "/r/release/[token]"],
    [`/renginiai/prieiga/${TOKEN}`, "/renginiai/prieiga/[token]"],
    [`/renginiai/prisijungti/${TOKEN}?invite=1`, "/renginiai/prisijungti/[token]?invite=1"],
    [`/events/join/${TOKEN}`, "/events/join/[token]"],
    [`/lentos/prisijungti/${TOKEN}/`, "/lentos/prisijungti/[token]/"],
    [`/boards/join/${TOKEN}`, "/boards/join/[token]"],
    [`/partner/join/${TOKEN}`, "/partner/join/[token]"],
    [`/join/${TOKEN}#top`, "/join/[token]#top"],
    [`https://noriuto.lt/b/s/${TOKEN}`, "https://noriuto.lt/b/s/[token]"],
    [`http://localhost:3000/b/s/${TOKEN}`, "http://localhost:3000/b/s/[token]"],
    [`https://partner.noriuto.lt/join/${TOKEN}`, "https://partner.noriuto.lt/join/[token]"],
  ];
  for (const [url, expected] of cases) {
    assert.equal(redactSecrets(url), expected);
    assert.equal(redactSecrets(redactSecrets(url)), expected);
  }
});

test("replaces the token in an encoded link, such as the login page's next parameter", () => {
  assert.equal(
    redactSecrets(`/prisijungti?next=%2Flentos%2Fprisijungti%2F${TOKEN}`),
    "/prisijungti?next=%2Flentos%2Fprisijungti%2F[token]"
  );
  assert.equal(
    redactSecrets(`/x?u=https%3A%2F%2Fnoriuto.lt%2Fb%2Fs%2F${TOKEN}&y=1`),
    "/x?u=https%3A%2F%2Fnoriuto.lt%2Fb%2Fs%2F[token]&y=1"
  );
});

test("removes capability tokens from every part of an event", () => {
  const shareUrl = `https://noriuto.lt/b/s/${TOKEN}`;
  const event = {
    event: "$pageleave",
    properties: {
      $current_url: shareUrl,
      $pathname: `/b/s/${TOKEN}`,
      $referrer: `https://noriuto.lt/renginiai/prieiga/${TOKEN}`,
      $prev_pageview_pathname: `/r/release/${TOKEN}`,
      $elements_chain: `a:attr__href="/renginiai/prisijungti/${TOKEN}"nth-child="1";div:text="https://noriuto.lt/b/s/${TOKEN}"`,
    },
    $set_once: { $initial_current_url: shareUrl, $initial_pathname: `/b/s/${TOKEN}` },
  };
  const out = redactPayload(event);
  assert.ok(!JSON.stringify(out).includes(TOKEN));
  assert.equal(out.properties.$pathname, "/b/s/[token]");
  assert.equal(
    out.properties.$elements_chain,
    'a:attr__href="/renginiai/prisijungti/[token]"nth-child="1";div:text="https://noriuto.lt/b/s/[token]"'
  );
});
