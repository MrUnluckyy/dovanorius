// Tests for guest seat merging and the emailed-link lookup.
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const MIGRATIONS = [
  "../migrations/20261001120000_ss_draw_engine.sql",
  "../migrations/20261002090000_ss_assignments_respect_exclusions.sql",
  "../migrations/20261002120000_ss_exclusions_direction.sql",
  "../migrations/20261104120000_guest_event_access.sql",
];

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OWNER = 0;
const GUEST = 1;
const ACCOUNT = 2;
const OTHER = 3;
const EVENT = "10000000-0000-0000-0000-000000000000";
const MAIL = "ona@pastas.lt";

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  // The parts of production the shared fixture does not carry.
  await db.exec(`
    create role service_role nologin;
    create table auth.users (
      id uuid primary key, email text, email_change text,
      is_anonymous boolean not null default false, email_confirmed_at timestamptz
    );
    alter table public.ss_events add column if not exists join_token text;
    create table public.ss_event_invites (
      id uuid primary key default gen_random_uuid(),
      event_id uuid not null references public.ss_events(id) on delete cascade,
      email text, display_name text,
      token text not null unique default gen_random_uuid()::text,
      invited_by uuid, via_link boolean not null default false,
      accepted_at timestamptz, accepted_by uuid,
      created_at timestamptz not null default now()
    );
    create table public.ss_group_items (
      id uuid primary key default gen_random_uuid(),
      event_id uuid, claimed_by uuid, created_by uuid
    );
  `);
  for (const m of MIGRATIONS) await db.exec(read(m));
  await db.exec(
    `insert into profiles select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'p' || g
       from generate_series(0, 9) g;
     insert into auth.users (id, email, email_confirmed_at)
       values ('${uid(OWNER)}', 'owner@pastas.lt', now());
     insert into ss_events (id, owner_id, name, slug, type, status, join_token)
       values ('${EVENT}', '${uid(OWNER)}', 'E', 'e', 'secret_santa', 'drawn', 'join-token');
     insert into auth.users (id, is_anonymous) values ('${uid(GUEST)}', true);
     insert into ss_members (event_id, user_id, display_name, is_confirmed)
       values ('${EVENT}', '${uid(GUEST)}', 'Ona', true);
     insert into ss_event_invites (event_id, email, via_link, accepted_at, accepted_by)
       values ('${EVENT}', '${MAIL}', true, now(), '${uid(GUEST)}');
     insert into auth.users (id, email, email_confirmed_at)
       values ('${uid(OTHER)}', 'other@pastas.lt', now());
     insert into ss_members (event_id, user_id, is_confirmed) values ('${EVENT}', '${uid(OTHER)}', true);`
  );
  return db;
}

const addAccount = (db, { confirmed = true, email = MAIL } = {}) =>
  db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [
    uid(ACCOUNT), email, confirmed ? new Date().toISOString() : null,
  ]);

const seatsOf = async (db, n) =>
  (await db.query(`select display_name from ss_members where event_id = $1 and user_id = $2`, [EVENT, uid(n)])).rows;

async function draw(db) {
  const { rows } = await db.query(
    `insert into ss_draws (event_id, created_by) values ($1, $2) returning id`, [EVENT, uid(OWNER)]
  );
  await db.query(
    `insert into ss_assignments (draw_id, event_id, giver, receiver)
     values ($1,$2,$3,$4), ($1,$2,$4,$5), ($1,$2,$5,$3)`,
    [rows[0].id, EVENT, uid(GUEST), uid(OTHER), uid(OWNER)]
  );
}

test("signing up with the guest's address moves the seat and the pairing", async () => {
  const db = await freshDb();
  await draw(db);
  // Someone outside the ring: an excluded pair inside it would refuse the update.
  await db.query(`insert into ss_exclusions (event_id, a, b) values ($1, $2, $3)`, [EVENT, uid(GUEST), uid(4)]);
  await db.query(`insert into notifications (user_id, type, payload) values ($1, 'ss_drawn', '{}')`, [uid(GUEST)]);

  await addAccount(db);

  assert.deepEqual(await seatsOf(db, GUEST), []);
  assert.deepEqual(await seatsOf(db, ACCOUNT), [{ display_name: "Ona" }]);
  const pairs = (await db.query(`select giver, receiver from ss_assignments where event_id = $1`, [EVENT])).rows;
  assert.equal(pairs.filter((p) => p.giver === uid(ACCOUNT)).length, 1);
  assert.equal(pairs.filter((p) => p.receiver === uid(ACCOUNT)).length, 1);
  assert.ok(!pairs.some((p) => p.giver === uid(GUEST) || p.receiver === uid(GUEST)));
  const ex = (await db.query(`select a from ss_exclusions where event_id = $1`, [EVENT])).rows;
  assert.deepEqual(ex, [{ a: uid(ACCOUNT) }]);
  const n = (await db.query(`select user_id from notifications where type = 'ss_drawn'`)).rows;
  assert.deepEqual(n, [{ user_id: uid(ACCOUNT) }]);
});

test("an unverified signup cannot harvest a seat, and verifying later can", async () => {
  const db = await freshDb();
  await addAccount(db, { confirmed: false });
  assert.equal((await seatsOf(db, GUEST)).length, 1);
  assert.equal((await seatsOf(db, ACCOUNT)).length, 0);

  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [uid(ACCOUNT)]);
  assert.equal((await seatsOf(db, GUEST)).length, 0);
  assert.equal((await seatsOf(db, ACCOUNT)).length, 1);
});

test("matching ignores case and also reads a pending guest confirmation", async () => {
  const db = await freshDb();
  await db.query(`delete from ss_event_invites`);
  await db.query(`update auth.users set email_change = 'ONA@pastas.lt' where id = $1`, [uid(GUEST)]);
  await addAccount(db, { email: "Ona@Pastas.lt" });
  assert.equal((await seatsOf(db, ACCOUNT)).length, 1);
});

test("a different address merges nothing", async () => {
  const db = await freshDb();
  await addAccount(db, { email: "kita@pastas.lt" });
  assert.equal((await seatsOf(db, GUEST)).length, 1);
  assert.equal((await seatsOf(db, ACCOUNT)).length, 0);
});

test("already a member with no pairing: the account takes the pairing, the ghost goes", async () => {
  const db = await freshDb();
  await addAccount(db, { email: "tmp@pastas.lt" });
  await db.query(`insert into ss_members (event_id, user_id, role, is_confirmed) values ($1, $2, 'admin', true)`, [EVENT, uid(ACCOUNT)]);
  await draw(db);
  await db.query(`update auth.users set email = $1 where id = $2`, [MAIL, uid(ACCOUNT)]);

  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid(ACCOUNT)]);
  const { rows } = await db.query(`select public.claim_guest_event_seats() as moved`);
  assert.equal(rows[0].moved, 1);
  assert.equal((await seatsOf(db, GUEST)).length, 0);
  const role = (await db.query(`select role from ss_members where event_id = $1 and user_id = $2`, [EVENT, uid(ACCOUNT)])).rows;
  assert.deepEqual(role, [{ role: "admin" }]);
  const mine = (await db.query(`select 1 from ss_assignments where giver = $1`, [uid(ACCOUNT)])).rows;
  assert.equal(mine.length, 1);
});

test("both uids in the draw: nothing moves, so nobody draws themselves", async () => {
  const db = await freshDb();
  await addAccount(db, { email: "tmp@pastas.lt" });
  await db.query(`insert into ss_members (event_id, user_id, is_confirmed) values ($1, $2, true)`, [EVENT, uid(ACCOUNT)]);
  await draw(db);
  await db.query(`update ss_assignments set receiver = $1 where receiver = $2`, [uid(ACCOUNT), uid(GUEST)]);
  await db.query(`update auth.users set email = $1 where id = $2`, [MAIL, uid(ACCOUNT)]);

  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid(ACCOUNT)]);
  const { rows } = await db.query(`select public.claim_guest_event_seats() as moved`);
  assert.equal(rows[0].moved, 0);
  assert.equal((await seatsOf(db, GUEST)).length, 1);
  const self = (await db.query(`select 1 from ss_assignments where giver = receiver`)).rows;
  assert.equal(self.length, 0);
});

test("a failing merge never blocks the sign-up", async () => {
  const db = await freshDb();
  await db.exec(`create function public.ss_boom() returns trigger language plpgsql as $$
    begin raise exception 'boom'; end $$;
    create trigger boom before update on public.ss_members
    for each row execute function public.ss_boom();`);
  await addAccount(db);
  assert.equal((await db.query(`select 1 from auth.users where id = $1`, [uid(ACCOUNT)])).rows.length, 1);
  assert.equal((await seatsOf(db, GUEST)).length, 1);
});

test("resolve: only people on the roster get a link", async () => {
  const db = await freshDb();
  const resolve = async (mail) =>
    (await db.query(`select * from public.ss_access_resolve($1, $2)`, [EVENT, mail])).rows;

  assert.deepEqual(await resolve("ONA@pastas.lt "), [{ user_id: uid(GUEST), is_guest: true }]);
  assert.deepEqual(await resolve("other@pastas.lt"), [{ user_id: uid(OTHER), is_guest: false }]);
  assert.deepEqual(await resolve("nobody@pastas.lt"), []);
  assert.deepEqual(await resolve(""), []);

  // Removed by the organiser: the old invite row must not keep the door open.
  await db.query(`delete from ss_members where user_id = $1`, [uid(GUEST)]);
  assert.deepEqual(await resolve(MAIL), []);
});

test("join form status recognises a seat before offering to join again", async () => {
  const db = await freshDb();
  const status = async (mail) =>
    (await db.query(`select public.ss_join_email_status('join-token', $1) as s`, [mail])).rows[0].s;

  assert.equal(await status(MAIL), "member");
  assert.equal(await status("other@pastas.lt"), "member");
  assert.equal(await status("owner@pastas.lt"), "member");
  await addAccount(db, { email: "turi@pastas.lt" });
  assert.equal(await status("turi@pastas.lt"), "account");
  assert.equal(await status("new@pastas.lt"), "free");
  const bad = await db.query(`select public.ss_join_email_status('nope', $1) as s`, [MAIL]);
  assert.equal(bad.rows[0].s, "invalid_token");
});

test("a guest can correct the address on their own seat, and only their own", async () => {
  const db = await freshDb();
  const setMail = async (n, mail) => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid(n)]);
    return (await db.query(`select public.ss_set_my_guest_email($1, $2) as r`, [EVENT, mail])).rows[0].r;
  };

  assert.deepEqual(await setMail(GUEST, "naujas@pastas.lt"), { ok: true });
  const { rows } = await db.query(`select public.ss_my_guest_email($1) as e`, [EVENT]);
  assert.equal(rows[0].e, "naujas@pastas.lt");

  assert.equal((await setMail(GUEST, "not-an-email")).error, "invalid_email");
  assert.equal((await setMail(GUEST, "other@pastas.lt")).error, "email_has_account");
  assert.equal((await setMail(OTHER, "x@pastas.lt")).error, "not_a_guest");
});
