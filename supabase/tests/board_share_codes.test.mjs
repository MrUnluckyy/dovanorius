// Tests for board share codes: assigned by the database, never changed.
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
  // Just the columns the trigger touches, plus both of prod's slug indexes.
  await db.exec(`
    create table public.boards (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text
    );
    create unique index boards_slug_key on public.boards (slug);
    create unique index boards_slug_unique on public.boards (slug) where slug is not null;
  `);
  return db;
}

const CODE = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;

test("insert gets a code, whatever slug the client sent", async () => {
  const db = await freshDb();
  await db.exec(read("../migrations/20261027120000_board_share_codes.sql"));
  const { rows } = await db.query(
    `insert into boards (name, slug) values
       ('Kalėdos', 'kaledos-3fa9c1'), ('Gimtadienis', null)
     returning slug`
  );
  for (const r of rows) assert.match(r.slug, CODE);
  assert.notEqual(rows[0].slug, rows[1].slug);
});

test("rename keeps the slug; slug can't be changed or cleared", async () => {
  const db = await freshDb();
  await db.exec(read("../migrations/20261027120000_board_share_codes.sql"));
  const { rows: [b] } = await db.query(
    `insert into boards (name) values ('Kalėdos') returning id, slug`
  );
  await db.query(`update boards set name = 'Gimtadienis' where id = $1`, [b.id]);
  await db.query(`update boards set slug = 'gimtadienis-xyz' where id = $1`, [b.id]);
  await db.query(`update boards set slug = null where id = $1`, [b.id]);
  const { rows: [after] } = await db.query(`select name, slug from boards where id = $1`, [b.id]);
  assert.equal(after.name, "Gimtadienis");
  assert.equal(after.slug, b.slug);
});

test("existing name-based slugs survive the migration untouched", async () => {
  const db = await freshDb();
  await db.exec(`insert into boards (name, slug) values ('Kalėdos', 'dovanos-kaledoms-3fa9c1')`);
  await db.exec(read("../migrations/20261027120000_board_share_codes.sql"));
  await db.exec(`update boards set name = 'Gimtadienis'`);
  const { rows } = await db.query(`select slug from boards`);
  assert.equal(rows[0].slug, "dovanos-kaledoms-3fa9c1");
});

test("a legacy row with no slug gets a code when its slug is touched", async () => {
  const db = await freshDb();
  await db.exec(`insert into boards (name, slug) values ('Senas', null)`);
  await db.exec(read("../migrations/20261027120000_board_share_codes.sql"));
  // PublishBoard writes `slug` when publishing a board.
  await db.exec(`update boards set slug = 'senas-abc123'`);
  const { rows } = await db.query(`select slug from boards`);
  assert.match(rows[0].slug, CODE);
});
