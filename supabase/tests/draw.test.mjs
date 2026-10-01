// Tests for the shared draw engine (ss_check_draw / ss_run_draw).
//
// Runs the real migration against an in-process Postgres (PGlite), on a schema
// that mirrors production (fixtures/base_schema.sql). Nothing touches the
// Supabase project.
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const MIGRATION = "../migrations/20261001120000_ss_draw_engine.sql";

/** user index -> uuid; 0 is the organiser. */
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let eventSeq = 0;

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(read(MIGRATION));
  await db.exec(
    `insert into profiles select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'p' || g
       from generate_series(0, 60) g`
  );
  return db;
}

async function as(db, n) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [n == null ? "" : uid(n)]);
}

/**
 * An event owned by user 0 (who is NOT in the draw unless listed) with the
 * given confirmed members and exclusion pairs.
 */
async function makeEvent(db, { type = "secret_santa", members, exclusions = [], previous = null, avoid = true, status = "open" }) {
  const id = `10000000-0000-0000-0000-${String(++eventSeq).padStart(12, "0")}`;
  await as(db, null);
  await db.query(
    `insert into ss_events (id, owner_id, name, slug, type, status, previous_event_id, avoid_previous_match)
     values ($1, $2, 'E', $3, $4, $5::ss_status, $6, $7)`,
    [id, uid(0), `e${eventSeq}`, type, status, previous, avoid]
  );
  // The owner is auto-added as a confirmed member; take them out of the draw
  // unless listed, so scenarios are exactly the people named.
  if (!members.includes(0)) {
    await db.query(`update ss_members set is_confirmed = false where event_id = $1 and user_id = $2`, [id, uid(0)]);
  }
  for (const m of members) {
    await db.query(
      `insert into ss_members (event_id, user_id, is_confirmed) values ($1, $2, true)
       on conflict (event_id, user_id) do update set is_confirmed = true`,
      [id, uid(m)]
    );
  }
  for (const [a, b] of exclusions) {
    await db.query(`insert into ss_exclusions (event_id, a, b) values ($1, $2, $3)`, [id, uid(a), uid(b)]);
  }
  return id;
}

/** A finished previous edition with the given giver -> receiver pairs. */
async function makePreviousEvent(db, pairs) {
  const people = [...new Set(pairs.flat())];
  const id = await makeEvent(db, { members: people, status: "drawn" });
  const draw = (await db.query(`insert into ss_draws (event_id, created_by) values ($1, $2) returning id`, [id, uid(0)])).rows[0].id;
  for (const [g, r] of pairs) {
    await db.query(`insert into ss_assignments (draw_id, event_id, giver, receiver) values ($1, $2, $3, $4)`, [draw, id, uid(g), uid(r)]);
  }
  return id;
}

async function check(db, eventId) {
  await as(db, 0);
  return (await db.query(`select ss_check_draw($1) r`, [eventId])).rows[0].r;
}

async function run(db, eventId, who = 0) {
  await as(db, who);
  return (await db.query(`select ss_run_draw($1) r`, [eventId])).rows[0].r;
}

async function assignments(db, eventId) {
  await as(db, null);
  return (await db.query(`select giver::text g, receiver::text r from ss_assignments where event_id = $1`, [eventId])).rows;
}

/** Every confirmed member gives once and receives once, never themselves, never an excluded pair. */
async function assertValidDraw(db, eventId, members, exclusions = []) {
  const rows = await assignments(db, eventId);
  assert.equal(rows.length, members.length);
  const givers = new Set(rows.map((x) => x.g));
  const receivers = new Set(rows.map((x) => x.r));
  assert.equal(givers.size, members.length);
  assert.equal(receivers.size, members.length);
  for (const m of members) {
    assert.ok(givers.has(uid(m)));
    assert.ok(receivers.has(uid(m)));
  }
  const banned = new Set(exclusions.flatMap(([a, b]) => [`${uid(a)}>${uid(b)}`, `${uid(b)}>${uid(a)}`]));
  for (const { g, r } of rows) {
    assert.notEqual(g, r, "nobody draws themselves");
    assert.ok(!banned.has(`${g}>${r}`), "exclusions hold");
  }
  return rows;
}

// ---------------------------------------------------------------------------

test("2 people: name draw is predictable, secret santa is too few", async () => {
  const db = await freshDb();
  const nd = await makeEvent(db, { type: "name_draw", members: [1, 2] });
  const c = await check(db, nd);
  assert.equal(c.status, "predictable");
  assert.deepEqual(c.people.sort(), [uid(1), uid(2)]);
  const r = await run(db, nd);
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  await assertValidDraw(db, nd, [1, 2]);

  const ss = await makeEvent(db, { type: "secret_santa", members: [1, 2] });
  const c2 = await check(db, ss);
  assert.equal(c2.status, "impossible");
  assert.equal(c2.reason, "too_few");
  assert.deepEqual(await run(db, ss), { ok: false, error: "too_few", people: [] });
});

test("no_recipient names the person who has nobody left to draw", async () => {
  const db = await freshDb();
  const id = await makeEvent(db, { members: [1, 2, 3, 4], exclusions: [[1, 2], [1, 3], [1, 4]] });
  const c = await check(db, id);
  assert.equal(c.status, "impossible");
  assert.equal(c.reason, "no_recipient");
  assert.deepEqual(c.people, [uid(1)]);
  const r = await run(db, id);
  assert.equal(r.ok, false);
  assert.equal(r.error, "no_recipient");
  assert.equal((await assignments(db, id)).length, 0, "nothing written");
});

test("household_too_big: an exclusion group over half the members", async () => {
  const db = await freshDb();
  // 1, 2, 3 all exclude each other and need three recipients among 4 and 5.
  const id = await makeEvent(db, { members: [1, 2, 3, 4, 5], exclusions: [[1, 2], [1, 3], [2, 3]] });
  const c = await check(db, id);
  assert.equal(c.status, "impossible");
  assert.equal(c.reason, "household_too_big");
  assert.deepEqual(c.people.sort(), [uid(1), uid(2), uid(3)]);
});

test("every impossible draw is explained: no_recipient or household_too_big", async () => {
  // Exclusions are symmetric, so by Hall's theorem a draw blocked by hard
  // rules always has an exclusion group over half the members (or someone
  // with no option at all). impossible_other is a fallback that random
  // exclusion sets should never reach.
  const db = await freshDb();
  let impossible = 0;
  for (let round = 0; round < 150; round++) {
    const n = 3 + Math.floor(Math.random() * 6); // 3..8 people
    const members = Array.from({ length: n }, (_, i) => i + 1);
    const exclusions = [];
    for (let a = 1; a <= n; a++)
      for (let b = a + 1; b <= n; b++) if (Math.random() < 0.45) exclusions.push([a, b]);
    const id = await makeEvent(db, { members, exclusions });
    const c = await check(db, id);
    if (c.status === "impossible") {
      impossible++;
      assert.ok(["no_recipient", "household_too_big"].includes(c.reason), `unexplained: ${JSON.stringify({ n, exclusions, c })}`);
      assert.ok(c.people.length > 0);
    } else {
      // And whenever the check says yes, the draw really works.
      const r = await run(db, id);
      assert.equal(r.ok, true);
      await assertValidDraw(db, id, members, exclusions);
    }
  }
  assert.ok(impossible > 10, `only ${impossible} impossible cases generated`);
});

test("two couples with last year's pairs: the only draw left is predictable", async () => {
  const db = await freshDb();
  // Couples (1,2) and (3,4). Valid draws pair each couple with the other: 4 of
  // them. Last year 1->3, 2->4, 3->1, 4->2; avoiding those leaves exactly one.
  const prev = await makePreviousEvent(db, [[1, 3], [2, 4], [3, 1], [4, 2]]);
  const id = await makeEvent(db, { members: [1, 2, 3, 4], exclusions: [[1, 2], [3, 4]], previous: prev });
  const c = await check(db, id);
  assert.equal(c.status, "predictable");
  assert.equal(c.repeats, 0);
  const r = await run(db, id);
  assert.equal(r.ok, true);
  assert.equal(r.status, "predictable");
  const rows = await assertValidDraw(db, id, [1, 2, 3, 4], [[1, 2], [3, 4]]);
  const got = Object.fromEntries(rows.map(({ g, r }) => [g, r]));
  assert.deepEqual(got, { [uid(1)]: uid(4), [uid(2)]: uid(3), [uid(3)]: uid(2), [uid(4)]: uid(1) });

  // Without the soft rule the same event has 4 valid draws: ok.
  const id2 = await makeEvent(db, { members: [1, 2, 3, 4], exclusions: [[1, 2], [3, 4]], previous: prev, avoid: false });
  assert.equal((await check(db, id2)).status, "ok");
});

test("relaxed: last year's pairs can't all be avoided, so the fewest repeat", async () => {
  const db = await freshDb();
  // Last year (with 4 more people) 1 and 2 drew each other. This year 1, 2, 3
  // have two possible draws (the two 3-cycles); each repeats one of 1->2, 2->1.
  const prev = await makePreviousEvent(db, [[1, 2], [2, 1], [3, 4], [4, 3]]);
  const id = await makeEvent(db, { members: [1, 2, 3], previous: prev });
  const c = await check(db, id);
  assert.equal(c.status, "relaxed");
  assert.equal(c.repeats, 1);
  assert.equal(c.people.length, 1);
  assert.ok([uid(1), uid(2)].includes(c.people[0]));

  const r = await run(db, id);
  assert.equal(r.ok, true);
  assert.equal(r.status, "relaxed");
  assert.equal(r.repeats, 1);
  await assertValidDraw(db, id, [1, 2, 3]);
  await as(db, null);
  const draw = (await db.query(`select relaxed from ss_draws where event_id = $1`, [id])).rows[0];
  assert.equal(draw.relaxed.repeats, 1);

  // Only people in both events count: 3 drew 4 last year, 4 is not here.
  const name = await makeEvent(db, { type: "name_draw", members: [1, 2], previous: prev });
  const c2 = await check(db, name);
  assert.equal(c2.status, "relaxed");
  assert.equal(c2.repeats, 2);
});

test("12 people with random exclusions: always a valid draw, written once", async () => {
  const db = await freshDb();
  const members = Array.from({ length: 12 }, (_, i) => i + 1);
  for (let round = 0; round < 5; round++) {
    // Random couples plus a few extra exclusions; still drawable.
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const exclusions = [];
    for (let i = 0; i < 12; i += 2) exclusions.push([shuffled[i], shuffled[i + 1]]);
    exclusions.push([shuffled[0], shuffled[2]], [shuffled[5], shuffled[9]]);

    const id = await makeEvent(db, { members, exclusions });
    await as(db, null);
    await db.query(
      `insert into ss_invites (event_id, from_user, to_user, status) values ($1, $2, $3, 'pending')`,
      [id, uid(0), uid(40 + round)]
    );
    const c = await check(db, id);
    assert.equal(c.status, "ok");
    const r = await run(db, id);
    assert.equal(r.ok, true);
    assert.equal(r.count, 12);
    await assertValidDraw(db, id, members, exclusions);

    await as(db, null);
    const ev = (await db.query(`select status from ss_events where id = $1`, [id])).rows[0];
    assert.equal(ev.status, "drawn");
    const inv = (await db.query(`select status from ss_invites where event_id = $1`, [id])).rows[0];
    assert.equal(inv.status, "revoked", "pending invites are retired by the draw");

    // A second press is refused, not a second draw.
    assert.deepEqual(await run(db, id), { ok: false, error: "wrong_status" });
    assert.equal((await assignments(db, id)).length, 12);
  }
});

test("draws are spread across the valid options, not stuck on one", async () => {
  const db = await freshDb();
  // 4 people, no rules: 9 derangements. 40 draws should hit several.
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const id = await makeEvent(db, { members: [1, 2, 3, 4] });
    await run(db, id);
    const rows = await assignments(db, id);
    seen.add(rows.map(({ g, r }) => `${g.slice(-1)}${r.slice(-1)}`).sort().join(","));
  }
  assert.ok(seen.size >= 5, `only ${seen.size} distinct draws in 40`);
});

test("permissions and status", async () => {
  const db = await freshDb();
  const id = await makeEvent(db, { members: [1, 2, 3] });
  // Not an organiser.
  assert.deepEqual(await run(db, id, 1), { ok: false, error: "not_allowed" });
  await as(db, 1);
  await assert.rejects(db.query(`select ss_check_draw($1)`, [id]), /not_allowed/);
  // No session.
  await as(db, null);
  assert.deepEqual((await db.query(`select ss_run_draw($1) r`, [id])).rows[0].r, { ok: false, error: "not_authenticated" });
  // Unknown event.
  assert.deepEqual(await run(db, "10000000-0000-0000-0000-999999999999"), { ok: false, error: "not_found" });
  // Group gifts are not drawn.
  const g = await makeEvent(db, { type: "group", members: [1, 2, 3] });
  assert.deepEqual(await run(db, g), { ok: false, error: "not_draw_type" });
  // A co-organiser (role admin, not owner) can draw.
  await as(db, null);
  await db.query(`update ss_members set role = 'admin' where event_id = $1 and user_id = $2`, [id, uid(2)]);
  const r = await run(db, id, 2);
  assert.equal(r.ok, true);
  // Draft events (created by the app without a status) are drawable.
  const d = await makeEvent(db, { members: [1, 2, 3], status: "draft" });
  assert.equal((await run(db, d)).ok, true);
});

test("linking a previous event requires organising it", async () => {
  const db = await freshDb();
  const mine = await makeEvent(db, { members: [1, 2, 3] });
  // An event owned by someone else (user 5).
  await as(db, null);
  await db.query(`insert into ss_events (id, owner_id, name, slug) values ('20000000-0000-0000-0000-000000000001', $1, 'theirs', 'theirs')`, [uid(5)]);
  await as(db, 0);
  await assert.rejects(
    db.query(`update ss_events set previous_event_id = '20000000-0000-0000-0000-000000000001' where id = $1`, [mine]),
    /previous_event_not_allowed/
  );
  await assert.rejects(db.query(`update ss_events set previous_event_id = id where id = $1`, [mine]), /previous_event_self/);
  const other = await makeEvent(db, { members: [1, 2, 3] });
  await as(db, 0);
  await db.query(`update ss_events set previous_event_id = $1 where id = $2`, [other, mine]);
});

test("50 people stays fast", async () => {
  const db = await freshDb();
  const members = Array.from({ length: 50 }, (_, i) => i + 1);
  const exclusions = [];
  for (let i = 1; i < 50; i += 2) exclusions.push([i, i + 1]);
  const id = await makeEvent(db, { members, exclusions });
  const t = Date.now();
  await check(db, id);
  const r = await run(db, id);
  const ms = Date.now() - t;
  assert.equal(r.ok, true);
  await assertValidDraw(db, id, members, exclusions);
  assert.ok(ms < 10000, `check + draw took ${ms}ms`);
});
