// Tests for the owner-side PostHog events sent from the database.
//
//   pnpm test:sql
//
// PGlite has no pg_net or Vault, so both are stubbed: net.http_post records
// what it was asked to send, vault.decrypted_secrets is a plain table.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const MIGRATION = readFileSync(
  new URL("../migrations/20261027150000_posthog_owner_events.sql", here),
  "utf8"
);

const OWNER = "00000000-0000-0000-0000-00000000000a";
const GIVER = "00000000-0000-0000-0000-00000000000b";
const GUEST = "00000000-0000-0000-0000-00000000000c";

async function freshDb({ withKey = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema vault; create schema net;
    create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    create table net.sent (url text, body jsonb);
    create function net.http_post(url text, body jsonb, headers jsonb)
      returns bigint language sql as $$ insert into net.sent values (url, body); select 1::bigint $$;

    create type item_status as enum ('wanted', 'reserved', 'purchased');
    create table public.boards (id uuid primary key default gen_random_uuid(), owner_id uuid not null);
    create table public.items (
      id uuid primary key default gen_random_uuid(),
      board_id uuid not null references public.boards (id),
      status item_status not null default 'wanted',
      reserved_by uuid
    );
    create table public.board_opens (
      board_id uuid not null, owner_id uuid not null, visitor text not null,
      viewer_id uuid, source text not null, created_at timestamptz default now()
    );

    insert into auth.users values ('${OWNER}', false), ('${GIVER}', false), ('${GUEST}', true);
  `);
  if (withKey) {
    await db.exec(`insert into vault.decrypted_secrets values ('posthog_project_key', 'phc_test')`);
  }
  await db.exec(MIGRATION);
  const { rows: [b] } = await db.query(
    `insert into boards (owner_id) values ($1) returning id`, [OWNER]
  );
  const { rows: [i] } = await db.query(
    `insert into items (board_id) values ($1) returning id`, [b.id]
  );
  return { db, boardId: b.id, itemId: i.id };
}

const sent = async (db) => (await db.query(`select url, body from net.sent`)).rows;

test("a giver reserving sends received_reservation to the owner", async () => {
  const { db, boardId, itemId } = await freshDb();
  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [GIVER, itemId]);
  const rows = await sent(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, "https://eu.i.posthog.com/i/v0/e/");
  const body = rows[0].body;
  assert.equal(body.event, "received_reservation");
  assert.equal(body.distinct_id, OWNER);
  assert.equal(body.api_key, "phc_test");
  assert.equal(body.properties.board_id, boardId);
  assert.equal(body.properties.item_id, itemId);
  assert.equal(body.properties.reserver_is_guest, false);
  // Reservations are hidden from owners; the event must not name the giver.
  assert.ok(!JSON.stringify(body).includes(GIVER));
});

test("a guest reservation is flagged as a guest", async () => {
  const { db, itemId } = await freshDb();
  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [GUEST, itemId]);
  assert.equal((await sent(db))[0].body.properties.reserver_is_guest, true);
});

test("the owner reserving their own wish, other updates and re-saves send nothing", async () => {
  const { db, itemId } = await freshDb();
  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [OWNER, itemId]);
  await db.query(`update items set status = 'wanted', reserved_by = null where id = $1`, [itemId]);
  await db.query(`update items set status = 'purchased' where id = $1`, [itemId]);
  assert.equal((await sent(db)).length, 0);

  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [GIVER, itemId]);
  await db.query(`update items set status = 'reserved' where id = $1`, [itemId]); // already reserved
  assert.equal((await sent(db)).length, 1);
});

test("a new board open sends received_view to the owner", async () => {
  const { db, boardId } = await freshDb();
  await db.query(
    `insert into board_opens (board_id, owner_id, visitor, viewer_id, source) values ($1, $2, 'v:abc', null, 'web')`,
    [boardId, OWNER]
  );
  const [{ body }] = await sent(db);
  assert.equal(body.event, "received_view");
  assert.equal(body.distinct_id, OWNER);
  assert.deepEqual(
    { board_id: body.properties.board_id, opened_in: body.properties.opened_in, signed_in: body.properties.viewer_signed_in },
    { board_id: boardId, opened_in: "web", signed_in: false }
  );
});

test("with no key in Vault nothing is sent and nothing breaks", async () => {
  const { db, itemId } = await freshDb({ withKey: false });
  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [GIVER, itemId]);
  const { rows: [i] } = await db.query(`select status from items where id = $1`, [itemId]);
  assert.equal(i.status, "reserved");
  assert.equal((await sent(db)).length, 0);
});

test("a failing post never blocks the reservation", async () => {
  const { db, itemId } = await freshDb();
  await db.exec(`
    create or replace function net.http_post(url text, body jsonb, headers jsonb)
      returns bigint language plpgsql as $$ begin raise exception 'network down'; end $$;
  `);
  await db.query(`update items set status = 'reserved', reserved_by = $1 where id = $2`, [GIVER, itemId]);
  const { rows: [i] } = await db.query(`select status from items where id = $1`, [itemId]);
  assert.equal(i.status, "reserved");
});
