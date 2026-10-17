// Tests for collection ranking v1 (discover_rank_collections).
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

// Minimal stand-ins for the discover tables, columns as in prod (2026-10-17).
const SCHEMA = `
  create table if not exists auth.users (id uuid primary key);
  alter table profiles add column gender text, add column date_of_birth date;
  create table gift_personas (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null, kind text not null, audience text not null default 'adult',
    sort_order int not null default 0, is_active boolean not null default true,
    starts_at timestamptz, ends_at timestamptz
  );
  create table inspo_products (
    id text primary key, product_type text, in_stock boolean not null default true
  );
  create table persona_products (
    persona_id uuid references gift_personas(id) on delete cascade,
    product_id text references inspo_products(id), rank int
  );
  create table inspo_events (
    id bigint generated always as identity primary key,
    event_type text not null, product_id text, product_type text,
    user_id uuid, created_at timestamptz not null default now()
  );
`;

// A slice of today's shelves: the kids shelves first by sort_order, as on prod.
const SHELVES = [
  ["vaikuciui", "editorial", "kid", 1, ["toys", "tech"]],
  ["mazasis-meistras", "editorial", "kid", 2, ["toys", "tools"]],
  ["vaikai-lauke", "editorial", "kid", 3, ["shoes", "sport", "toys"]],
  ["rudens-grozio-ritualai", "editorial", "adult", 4, ["beauty"]],
  ["silta-ir-jauku", "editorial", "adult", 8, ["home", "kitchen"]],
  ["cosy-home", "theme", "adult", 15, ["home", "kitchen"]],
  ["tech-lover", "theme", "adult", 20, ["tech"]],
  ["for-kids", "theme", "kid", 30, ["toys"]],
  ["beauty-gifts", "theme", "adult", 40, ["beauty"]],
  ["for-makers", "theme", "adult", 60, ["tools"]],
  ["sport-outdoors", "theme", "adult", 70, ["sport"]],
  ["for-pets", "theme", "adult", 100, ["pets"]],
  // recipients: offered in the picker, not ranked
  ["child", "recipient", "kid", 50, ["toys"]],
  ["woman-30plus", "recipient", "adult", 20, ["beauty", "home"]],
];

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(SCHEMA);
  await db.exec(read("../migrations/20261017110000_discover_collection_ranking.sql"));
  for (const [slug, kind, audience, sort, types] of SHELVES) {
    await db.query(
      `insert into gift_personas (slug, kind, audience, sort_order) values ($1, $2, $3, $4)`,
      [slug, kind, audience, sort]
    );
    // Four picks minimum, like a shelf that actually renders.
    const picks = Array.from({ length: Math.max(4, types.length) }, (_, i) => types[i % types.length]);
    for (const [i, t] of picks.entries()) {
      const pid = `${slug}-${i}`;
      await db.query(`insert into inspo_products (id, product_type) values ($1, $2)`, [pid, t]);
      await db.query(
        `insert into persona_products select id, $2, $3 from gift_personas where slug = $1`,
        [slug, pid, i]
      );
    }
  }
  await db.exec(
    `insert into profiles (id, display_name) select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'p' || g from generate_series(0, 5) g`
  );
  return db;
}

async function as(db, n) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [n == null ? "" : uid(n)]);
}

async function rank(db, recipient = null, audience = null) {
  const { rows } = await db.query(
    `select slug, rank, is_top, reason, reason_detail from discover_rank_collections($1, $2)`,
    [recipient, audience]
  );
  return rows;
}

const top = (rows) => rows.filter((r) => r.is_top).map((r) => r.slug);
const KIDS = ["vaikuciui", "mazasis-meistras", "vaikai-lauke", "for-kids"];

test("an unknown visitor never gets a kids shelf in the top", async () => {
  const db = await freshDb();
  await as(db, null);
  const rows = await rank(db);
  assert.equal(top(rows).length, 4);
  for (const s of KIDS) assert.ok(!top(rows).includes(s), `${s} in top`);
  // ...but they stay reachable, after every general shelf
  const kidRanks = rows.filter((r) => KIDS.includes(r.slug)).map((r) => r.rank);
  assert.ok(Math.min(...kidRanks) > rows.length - KIDS.length);
});

test("recipient personas are not ranked as shelves", async () => {
  const db = await freshDb();
  await as(db, null);
  const slugs = (await rank(db)).map((r) => r.slug);
  assert.ok(!slugs.includes("child") && !slugs.includes("woman-30plus"));
});

test("gender and age alone never lift a kids shelf", async () => {
  const db = await freshDb();
  await db.query(`update profiles set gender = 'female', date_of_birth = '1988-03-01' where id = $1`, [uid(1)]);
  await as(db, 1);
  const rows = await rank(db);
  for (const s of KIDS) assert.ok(!top(rows).includes(s));
  // the prior does lift beauty/home for her
  assert.ok(top(rows).some((s) => ["beauty-gifts", "rudens-grozio-ritualai", "cosy-home", "silta-ir-jauku"].includes(s)));
});

test("tapping a kid recipient qualifies and lifts kids shelves", async () => {
  const db = await freshDb();
  await as(db, null);
  const rows = await rank(db, "child");
  const t = top(rows);
  assert.ok(KIDS.filter((s) => t.includes(s)).length >= 3, t.join(","));
  assert.equal(rows.find((r) => r.slug === "vaikuciui").reason, "recipient");
});

test("toy behaviour qualifies kids shelves; shoe behaviour does not", async () => {
  const db = await freshDb();
  // user 2 browses shoes only
  for (let i = 0; i < 5; i++) {
    await db.query(`insert into inspo_events (event_type, product_type, user_id) values ('open', 'shoes', $1)`, [uid(2)]);
  }
  await as(db, 2);
  assert.ok(!top(await rank(db)).includes("vaikai-lauke"));

  // user 3 saves toys
  for (let i = 0; i < 3; i++) {
    await db.query(`insert into inspo_events (event_type, product_type, user_id) values ('save', 'toys', $1)`, [uid(3)]);
  }
  await as(db, 3);
  const rows = await rank(db);
  assert.ok(KIDS.filter((s) => top(rows).includes(s)).length >= 2, top(rows).join(","));
  const kid = rows.find((r) => r.slug === "vaikuciui");
  assert.ok(kid.is_top);
  assert.equal(kid.reason, "behaviour");
  assert.equal(kid.reason_detail, "toys");
});

test("one top slot explores a shelf the visitor has not opened from", async () => {
  const db = await freshDb();
  await db.query(`update profiles set gender = 'male' where id = $1`, [uid(4)]);
  await as(db, 4);
  const rows = await rank(db);
  const explore = rows.filter((r) => r.is_top && r.reason === "explore");
  assert.equal(explore.length, 1);
  assert.equal(explore[0].rank, 4);
  assert.ok(!KIDS.includes(explore[0].slug));
});

test("shelves outside their schedule window are left out", async () => {
  const db = await freshDb();
  await db.exec(`update gift_personas set ends_at = now() - interval '1 day' where slug = 'beauty-gifts'`);
  await as(db, null);
  assert.ok(!(await rank(db)).some((r) => r.slug === "beauty-gifts"));
});

test("weights come from discover_config", async () => {
  const db = await freshDb();
  await db.exec(
    `update discover_config set value = jsonb_set(value, '{top}', '2') where key = 'collection_ranking'`
  );
  await as(db, null);
  assert.equal(top(await rank(db)).length, 2);
});

test("a shelf with fewer than 4 in-stock picks is left out", async () => {
  const db = await freshDb();
  await db.exec(`update inspo_products set in_stock = false where id in ('tech-lover-0', 'tech-lover-1')`);
  await as(db, null);
  assert.ok(!(await rank(db)).some((r) => r.slug === "tech-lover"));
});

test("config is not readable through the API roles", async () => {
  const db = await freshDb();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
      where table_name = 'discover_config' and grantee in ('anon', 'authenticated')`
  );
  assert.equal(rows[0].n, 0);
});
