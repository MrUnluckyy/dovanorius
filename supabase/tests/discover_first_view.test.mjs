// Tests for the first-view migration (last_recipient + discover_my_categories).
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(`
    create table if not exists auth.users (id uuid primary key);
    create table inspo_events (
      id bigint generated always as identity primary key,
      event_type text not null, product_type text, user_id uuid,
      created_at timestamptz not null default now()
    );
  `);
  await db.exec(read("../migrations/20261020052009_discover_first_view.sql"));
  await db.exec(`insert into profiles (id, display_name) values ('${uid(1)}', 'a'), ('${uid(2)}', 'b')`);
  return db;
}

const as = (db, n) =>
  db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [n == null ? "" : uid(n)]);

test("last_recipient takes known keys only", async () => {
  const db = await freshDb();
  await db.query(`update profiles set last_recipient = 'kid' where id = $1`, [uid(1)]);
  await assert.rejects(db.query(`update profiles set last_recipient = 'boss' where id = $1`, [uid(1)]));
});

test("authenticated can update last_recipient", async () => {
  const db = await freshDb();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.column_privileges
      where table_name = 'profiles' and column_name = 'last_recipient'
        and grantee = 'authenticated' and privilege_type = 'UPDATE'`
  );
  assert.equal(rows[0].n, 1);
});

test("my categories: only the caller's, saves double, 'other' and old rows left out", async () => {
  const db = await freshDb();
  const ev = (type, pt, user, ago = "1 day") =>
    db.query(
      `insert into inspo_events (event_type, product_type, user_id, created_at)
       values ($1, $2, $3, now() - $4::interval)`,
      [type, pt, uid(user), ago]
    );
  await ev("open", "beauty", 1);
  await ev("open", "beauty", 1);
  await ev("save", "home", 1);
  await ev("save", "home", 1);
  await ev("open", "other", 1);
  await ev("open", "tech", 1, "120 days");
  await ev("open", "toys", 2);

  await as(db, 1);
  const { rows } = await db.query(`select product_type, weight::int as w from discover_my_categories()`);
  assert.deepEqual(rows, [
    { product_type: "home", w: 4 },
    { product_type: "beauty", w: 2 },
  ]);

  await as(db, null);
  const anon = await db.query(`select * from discover_my_categories()`);
  assert.equal(anon.rows.length, 0);
});
