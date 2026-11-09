// Tests for managed participants (people the organiser adds by name).
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OWNER = 0;
const MEMBER = 1;
const MANAGED = 2;
const STRANGER = 3;
const ACCOUNT = 4;
const EVENT = "10000000-0000-0000-0000-000000000000";

async function freshDb({ type = "secret_santa", status = "open" } = {}) {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  // The parts of production the shared fixture does not carry.
  await db.exec(`
    create role service_role nologin;
    create table auth.users (
      id uuid primary key, email text, is_anonymous boolean not null default false,
      created_at timestamptz not null default now()
    );
    alter table public.profiles add column public boolean default true;
    create type public.board_role as enum ('owner', 'editor', 'viewer');
    create table public.boards (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references public.profiles(id) on delete cascade,
      name text not null, slug text, description text,
      is_public boolean not null default true,
      created_at timestamptz default now()
    );
    create table public.board_members (
      board_id uuid not null references public.boards(id) on delete cascade,
      user_id uuid not null references public.profiles(id) on delete cascade,
      role public.board_role not null default 'editor',
      display_name text,
      unique (board_id, user_id)
    );
    create table public.items (
      id uuid primary key default gen_random_uuid(),
      board_id uuid references public.boards(id) on delete cascade,
      image_url text, status text default 'wanted', archived_at timestamptz,
      created_at timestamptz default now()
    );
    -- Stand-in for prod's boards_owner_member trigger.
    create function public.add_owner_member() returns trigger language plpgsql as $$
    begin
      insert into public.board_members (board_id, user_id, role) values (new.id, new.owner_id, 'owner')
      on conflict do nothing;
      return new;
    end $$;
    create trigger boards_owner_member after insert on public.boards
      for each row execute function public.add_owner_member();
  `);
  await db.exec(read("../migrations/20261107120000_ss_managed_members.sql"));
  await db.exec(read("../migrations/20261109120000_managed_cleanup_and_board_guards.sql"));
  await db.exec(`
    insert into profiles (id, display_name)
      select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'p' || g
        from generate_series(0, 9) g;
    insert into auth.users (id, email) values ('${uid(OWNER)}', 'owner@pastas.lt'),
      ('${uid(MEMBER)}', 'member@pastas.lt'), ('${uid(STRANGER)}', 'x@pastas.lt'),
      ('${uid(ACCOUNT)}', 'acc@pastas.lt');
    insert into auth.users (id, is_anonymous) values ('${uid(MANAGED)}', true);
    update profiles set public = false where id = '${uid(MANAGED)}';
    insert into ss_events (id, owner_id, name, slug, type, status)
      values ('${EVENT}', '${uid(OWNER)}', 'Kalėdos', 'kaledos', '${type}', '${status}');
    -- The owner's seat comes from the fixture's ss_add_owner_as_member trigger.
    insert into ss_members (event_id, user_id, role, is_confirmed)
      values ('${EVENT}', '${uid(MEMBER)}', 'member', true);
  `);
  return db;
}

const setup = async (db, { manager = OWNER, user = MANAGED, name = "Močiutė Ona" } = {}) =>
  (
    await db.query(`select ss_setup_managed_member($1, $2, $3, $4) as r`, [
      EVENT, uid(manager), uid(user), name,
    ])
  ).rows[0].r;

const as = (db, n) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid(n)]);

test("the organiser adds a managed person with a wish list they can edit", async () => {
  const db = await freshDb();
  const r = await setup(db);
  assert.equal(r.ok, true);

  const seat = (await db.query(
    `select display_name, role::text, is_confirmed from ss_members where event_id = $1 and user_id = $2`,
    [EVENT, uid(MANAGED)]
  )).rows;
  assert.deepEqual(seat, [{ display_name: "Močiutė Ona", role: "member", is_confirmed: true }]);

  const prof = (await db.query(`select display_name, public from profiles where id = $1`, [uid(MANAGED)])).rows[0];
  assert.deepEqual(prof, { display_name: "Močiutė Ona", public: false });

  const mu = (await db.query(`select manager_id, created_in_event from managed_users`)).rows;
  assert.deepEqual(mu, [{ manager_id: uid(OWNER), created_in_event: EVENT }]);

  const board = (await db.query(`select id, owner_id, is_public from boards`)).rows;
  assert.equal(board.length, 1);
  assert.equal(board[0].id, r.board_id);
  assert.equal(board[0].owner_id, uid(MANAGED));
  assert.equal(board[0].is_public, true);
  const members = (await db.query(
    `select user_id, role::text from board_members where board_id = $1 order by role::text desc`, [r.board_id]
  )).rows;
  assert.deepEqual(members, [
    { user_id: uid(MANAGED), role: "owner" },
    { user_id: uid(OWNER), role: "editor" },
  ]);
});

test("a name draw gets the seat but no wish list", async () => {
  const db = await freshDb({ type: "name_draw" });
  const r = await setup(db);
  assert.equal(r.ok, true);
  assert.equal(r.board_id, null);
  assert.equal((await db.query(`select 1 from boards`)).rows.length, 0);
});

test("only an organiser can add, and only before the draw", async () => {
  assert.equal((await setup(await freshDb(), { manager: MEMBER })).error, "not_allowed");
  assert.equal((await setup(await freshDb(), { manager: STRANGER })).error, "not_allowed");
  assert.equal((await setup(await freshDb({ status: "drawn" }))).error, "event_closed");
  assert.equal((await setup(await freshDb({ status: "locked" }))).error, "event_closed");
  assert.equal((await setup(await freshDb(), { name: "   " })).error, "name_required");

  const db = await freshDb();
  await db.query(`update ss_members set role = 'admin' where user_id = $1`, [uid(MEMBER)]);
  assert.equal((await setup(db, { manager: MEMBER })).ok, true);
});

test("cannot take over a real account, a used guest or an old user", async () => {
  // A real account.
  assert.equal((await setup(await freshDb(), { user: ACCOUNT })).error, "bad_user");

  // A guest already sitting in an event.
  let db = await freshDb();
  await db.query(`insert into ss_members (event_id, user_id) values ($1, $2)`, [EVENT, uid(MANAGED)]);
  assert.equal((await setup(db)).error, "bad_user");

  // An anonymous user that is not freshly made.
  db = await freshDb();
  await db.query(`update auth.users set created_at = now() - interval '1 hour' where id = $1`, [uid(MANAGED)]);
  assert.equal((await setup(db)).error, "bad_user");

  // Twice.
  db = await freshDb();
  assert.equal((await setup(db)).ok, true);
  assert.equal((await setup(db)).error, "bad_user");
});

test("clients can neither call setup nor write managed_users", async () => {
  const db = await freshDb();
  const priv = (await db.query(`
    select has_function_privilege('authenticated', 'public.ss_setup_managed_member(uuid,uuid,uuid,text)', 'execute') as auth,
           has_function_privilege('anon', 'public.ss_setup_managed_member(uuid,uuid,uuid,text)', 'execute') as anon,
           has_function_privilege('service_role', 'public.ss_setup_managed_member(uuid,uuid,uuid,text)', 'execute') as svc,
           has_table_privilege('authenticated', 'public.managed_users', 'insert') as ins
  `)).rows[0];
  assert.deepEqual(priv, { auth: false, anon: false, svc: true, ins: false });
});

test("only the manager sees and reveals the managed person's draw", async () => {
  const db = await freshDb();
  await setup(db);
  const { rows } = await db.query(
    `insert into ss_draws (event_id, created_by) values ($1, $2) returning id`, [EVENT, uid(OWNER)]
  );
  await db.query(
    `insert into ss_assignments (draw_id, event_id, giver, receiver)
     values ($1,$2,$3,$4), ($1,$2,$4,$5), ($1,$2,$5,$3)`,
    [rows[0].id, EVENT, uid(OWNER), uid(MEMBER), uid(MANAGED)]
  );
  await db.query(`update ss_events set status = 'drawn' where id = $1`, [EVENT]);

  const look = async (n) => {
    await as(db, n);
    return (await db.query(`select ss_managed_assignment($1, $2) as r`, [EVENT, uid(MANAGED)])).rows[0].r;
  };
  assert.deepEqual(await look(OWNER), { receiver: uid(OWNER), revealed: false });
  assert.equal(await look(MEMBER), null);
  assert.equal(await look(STRANGER), null);

  const revealed = async () =>
    (await db.query(`select revealed from ss_assignments where giver = $1`, [uid(MANAGED)])).rows[0].revealed;

  await as(db, MEMBER);
  await db.query(`select ss_mark_revealed_managed($1, $2)`, [EVENT, uid(MANAGED)]);
  assert.equal(await revealed(), false);

  await as(db, OWNER);
  await db.query(`select ss_mark_revealed_managed($1, $2)`, [EVENT, uid(MANAGED)]);
  assert.equal(await revealed(), true);
});

test("the managed person's board stays off the organiser's profile", async () => {
  const db = await freshDb();
  const r = await setup(db);
  await db.query(`insert into boards (owner_id, name) values ($1, 'Mano norai')`, [uid(OWNER)]);
  // Somebody else's board the organiser edits still shows, as before.
  const shared = (await db.query(
    `insert into boards (owner_id, name) values ($1, 'Bendras') returning id`, [uid(MEMBER)]
  )).rows[0].id;
  await db.query(`insert into board_members (board_id, user_id, role) values ($1, $2, 'editor')`, [shared, uid(OWNER)]);

  const names = async (n) =>
    (await db.query(`select name from users_boards_with_previews($1) order by name`, [uid(n)])).rows.map((x) => x.name);

  assert.deepEqual(await names(OWNER), ["Bendras", "Mano norai"]);
  assert.deepEqual(await names(MANAGED), ["Močiutė Ona – norų sąrašas"]);
  assert.ok(r.board_id);
});

test("deleting the managed person takes the seat, board and managed row with them", async () => {
  const db = await freshDb();
  await setup(db);
  // auth.users -> profiles cascades in prod; here we delete the profile directly.
  await db.query(`delete from ss_members where user_id = $1`, [uid(MANAGED)]);
  await db.query(`delete from profiles where id = $1`, [uid(MANAGED)]);
  assert.equal((await db.query(`select 1 from managed_users`)).rows.length, 0);
  assert.equal((await db.query(`select 1 from boards`)).rows.length, 0);
});

// ── 20261109120000: cleanup trigger + board guards ──────────────────────────
// The fixture's profiles do not reference auth.users, so these check the
// auth.users row itself; the cascade to profile and board was dry-run on prod.

const authUser = async (db, n) =>
  (await db.query(`select 1 from auth.users where id = $1`, [uid(n)])).rows.length;

test("deleting the event deletes the managed person", async () => {
  const db = await freshDb();
  assert.equal((await setup(db)).ok, true);
  await db.query(`delete from ss_events where id = $1`, [EVENT]);
  assert.equal(await authUser(db, MANAGED), 0);
  // Real people in the event are untouched.
  assert.equal(await authUser(db, MEMBER), 1);
  assert.equal(await authUser(db, OWNER), 1);
});

test("removing the seat deletes them, unless they are still in another event", async () => {
  const db = await freshDb();
  assert.equal((await setup(db)).ok, true);
  const OTHER = "20000000-0000-0000-0000-000000000000";
  await db.query(
    `insert into ss_events (id, owner_id, name, slug, type, status)
       values ($1, $2, 'Velykos', 'velykos', 'secret_santa', 'open')`,
    [OTHER, uid(OWNER)]
  );
  await db.query(
    `insert into ss_members (event_id, user_id, role, is_confirmed) values ($1, $2, 'member', true)`,
    [OTHER, uid(MANAGED)]
  );

  await db.query(`delete from ss_members where event_id = $1 and user_id = $2`, [EVENT, uid(MANAGED)]);
  assert.equal(await authUser(db, MANAGED), 1);

  await db.query(`delete from ss_members where event_id = $1 and user_id = $2`, [OTHER, uid(MANAGED)]);
  assert.equal(await authUser(db, MANAGED), 0);
});

test("an anonymous guest who is not managed is never deleted", async () => {
  const db = await freshDb();
  await db.query(`update auth.users set is_anonymous = true where id = $1`, [uid(MEMBER)]);
  await db.query(`delete from ss_members where user_id = $1`, [uid(MEMBER)]);
  assert.equal(await authUser(db, MEMBER), 1);
});

test("only the owner can change who owns a board", async () => {
  const db = await freshDb();
  const r = await setup(db);
  const steal = () =>
    db.query(`update boards set owner_id = $1 where id = $2`, [uid(OWNER), r.board_id]);

  // The organiser edits the managed person's board, but cannot take it.
  await as(db, OWNER);
  await assert.rejects(steal, /only the owner/);

  // Editing everything else still works.
  await db.query(`update boards set name = 'Naujas' where id = $1`, [r.board_id]);

  // Server-side (no auth.uid()) may.
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await steal();
  assert.equal(
    (await db.query(`select owner_id from boards where id = $1`, [r.board_id])).rows[0].owner_id,
    uid(OWNER)
  );
});
