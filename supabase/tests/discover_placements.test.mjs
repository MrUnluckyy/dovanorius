// Tests for sponsored placements (discover_placements + ad events/stats).
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(`
    create table if not exists auth.users (id uuid primary key);
    create schema if not exists storage;
    create table storage.buckets (id text primary key, name text, public boolean);
  `);
  await db.exec(read("../migrations/20260731100300_inspo_events_analytics.sql"));
  await db.exec(read("../migrations/20261017165811_discover_tracking.sql"));
  await db.exec(read("../migrations/20261020120000_discover_placements.sql"));
  await db.exec(`grant select on public.discover_placements to anon`);
  return db;
}

const add = (db, fields = {}) =>
  db.query(
    `insert into discover_placements (advertiser, headline, image_url, cta_url, is_active, starts_at, ends_at)
     values ($1, $2, 'https://x/i.jpg', $3, $4, $5, $6) returning id`,
    [
      fields.advertiser ?? "Mideer",
      fields.headline ?? "Žaislai, kurie moko",
      fields.cta_url ?? "https://mideer.lt",
      fields.is_active ?? true,
      fields.starts_at ?? null,
      fields.ends_at ?? null,
    ]
  );

test("the public sees only live placements", async () => {
  const db = await freshDb();
  await add(db, { advertiser: "Live" });
  await add(db, { advertiser: "Off", is_active: false });
  await add(db, { advertiser: "Later", starts_at: new Date(Date.now() + 864e5).toISOString() });
  await add(db, { advertiser: "Ended", ends_at: new Date(Date.now() - 864e5).toISOString() });

  await db.exec(`set role anon`);
  const { rows } = await db.query(`select advertiser from discover_placements`);
  assert.deepEqual(rows.map((r) => r.advertiser), ["Live"]);
});

test("links must be https and products are capped at six", async () => {
  const db = await freshDb();
  await assert.rejects(add(db, { cta_url: "http://insecure.lt" }));
  await assert.rejects(add(db, { cta_url: "javascript:alert(1)" }));
  await assert.rejects(
    db.query(
      `insert into discover_placements (advertiser, headline, image_url, cta_url, product_ids)
       values ('A', 'B', 'https://x', 'https://y', array['1','2','3','4','5','6','7'])`
    )
  );
});

test("the public cannot write placements", async () => {
  const db = await freshDb();
  await db.exec(`set role anon`);
  await assert.rejects(add(db));
});

test("stats count unique sessions per placement per day", async () => {
  const db = await freshDb();
  const { rows } = await add(db);
  const id = rows[0].id;
  const ev = (type, session) =>
    db.query(
      `insert into inspo_events (event_type, session_id, context) values ($1, $2, $3)`,
      [type, session, JSON.stringify({ placement: id })]
    );
  await ev("ad_view", "s1");
  await ev("ad_view", "s1"); // same visitor scrolling past again
  await ev("ad_view", "s2");
  await ev("ad_click", "s2");
  // junk placement ids never reach the uuid cast
  await db.query(
    `insert into inspo_events (event_type, session_id, context) values ('ad_view', 's3', '{"placement":"nope"}')`
  );

  const stats = await db.query(`select placement_id, views::int, clicks::int from discover_ad_stats`);
  assert.deepEqual(stats.rows, [{ placement_id: id, views: 2, clicks: 1 }]);
});

test("ad stats are not exposed to API roles", async () => {
  const db = await freshDb();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
      where table_name = 'discover_ad_stats' and grantee in ('anon', 'authenticated')`
  );
  assert.equal(rows[0].n, 0);
});
