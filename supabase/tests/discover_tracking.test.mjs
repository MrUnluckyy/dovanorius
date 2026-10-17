// Tests for discover tracking (inspo_events session/context + funnel views).
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const MIGRATIONS = [
  "../migrations/20260731100300_inspo_events_analytics.sql",
  "../migrations/20261017165811_discover_tracking.sql",
];

async function freshDb() {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  // inspo_events references auth.users, which the shared fixture leaves out.
  await db.exec(`create table if not exists auth.users (id uuid primary key)`);
  for (const m of MIGRATIONS) await db.exec(read(m));
  return db;
}

const ev = (db, type, session, context = null, at = "2026-10-17 10:00+03") =>
  db.query(
    `insert into inspo_events (event_type, session_id, context, created_at)
     values ($1, $2, $3, $4)`,
    [type, session, context && JSON.stringify(context), at]
  );

test("old writers still insert without session or context", async () => {
  const db = await freshDb();
  await db.query(`insert into inspo_events (event_type, product_id) values ('open', 'p1')`);
  const { rows } = await db.query(`select count(*)::int as n from inspo_events`);
  assert.equal(rows[0].n, 1);
});

test("unknown event types are still refused", async () => {
  const db = await freshDb();
  await assert.rejects(ev(db, "page_view", "s1"));
});

test("funnel counts a session with no open as bounced, per first state", async () => {
  const db = await freshDb();
  // s1: viewed state 1, opened a product -> not bounced
  await ev(db, "discover_view", "s1", { page: "inspire", state: "1" });
  await ev(db, "open", "s1", { page: "inspire" }, "2026-10-17 10:01+03");
  // s2: viewed state 1, left -> bounced
  await ev(db, "discover_view", "s2", { page: "inspire", state: "1" });
  // s3: viewed state 3, then browse, clicked out
  await ev(db, "discover_view", "s3", { page: "inspire", state: "3" });
  await ev(db, "discover_view", "s3", { page: "browse", state: "legacy" }, "2026-10-17 10:02+03");
  await ev(db, "open", "s3", null, "2026-10-17 10:03+03");
  await ev(db, "click_out", "s3", null, "2026-10-17 10:04+03");
  // s4: events but no discover_view -> excluded
  await ev(db, "open", "s4");

  const { rows } = await db.query(
    `select state, sessions::int, bounced::int, bounce_pct::float, clicked_out::int
       from discover_session_funnel order by state`
  );
  assert.deepEqual(rows, [
    { state: "1", sessions: 2, bounced: 1, bounce_pct: 50, clicked_out: 0 },
    { state: "3", sessions: 1, bounced: 0, bounce_pct: 0, clicked_out: 1 },
  ]);
});

test("nudge funnel groups by question", async () => {
  const db = await freshDb();
  await ev(db, "nudge_shown", "s1", { question: "gender" });
  await ev(db, "nudge_answered", "s1", { question: "gender", answer: "female" });
  await ev(db, "nudge_shown", "s2", { question: "gender" });
  await ev(db, "nudge_dismissed", "s2", { question: "gender" });
  const { rows } = await db.query(
    `select question, shown::int, answered::int, dismissed::int from discover_nudge_funnel`
  );
  assert.deepEqual(rows, [{ question: "gender", shown: 2, answered: 1, dismissed: 1 }]);
});

test("funnel views are not exposed to API roles", async () => {
  const db = await freshDb();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
      where table_name in ('discover_session_funnel', 'discover_nudge_funnel')
        and grantee in ('anon', 'authenticated')`
  );
  assert.equal(rows[0].n, 0);
});
