// Tests for discover_products (A/B rebuild behind a view) and discover_page.
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

const TYPES = ["beauty", "home", "tech", "toys"];
const GENDERS = ["female", "male", null];

async function freshDb(rows = 1500) {
  const db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(`
    do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
    create table public.inspo_products (
      id text primary key, product_name text, brand_name text, merchant_name text,
      partner_id uuid, price numeric, rrp numeric, discount_pct numeric,
      image_url text, deep_link text, product_type text, gender text, audience text,
      season text, gift_score integer, sort_key double precision,
      in_stock boolean, giftable boolean
    );
  `);
  await db.exec(read("../migrations/20261020100851_product_display_name.sql"));
  // the index drop at the end of the migration targets prod-only indexes
  await db.exec(read("../migrations/20261020160000_discover_products.sql"));
  await seed(db, rows);
  return db;
}

async function seed(db, rows) {
  await db.exec(`truncate inspo_products`);
  await db.query(
    `insert into inspo_products
     select 'p' || lpad(g::text, 5, '0'),
            'Fossil Laikrodis Nr' || g || ' ES5305 Auksinė', 'Fossil', 'Modivo LT', null,
            10 + (g * 7 % 300), null,
            case when g % 4 = 0 then (g % 90) else null end,
            'https://img/' || g, 'https://shop/' || g,
            ($1::text[])[1 + g % 4], ($2::text[])[1 + g % 3], 'adult',
            case when g % 10 = 0 then 'summer' else null end,
            50 + (g % 40), (g * 0.618) - floor(g * 0.618),
            g % 50 <> 0,          -- 2 % out of stock
            g % 25 <> 0           -- 4 % not giftable
       from generate_series(1, $3) g`,
    [TYPES, GENDERS, rows]
  );
}

const page = (db, args) =>
  db.query(
    `select id, pos, price, discount_pct, product_type, gender, season
       from discover_page(p_product_type => $1, p_product_types => $2, p_audience => $3,
                          p_price_min => $4, p_price_max => $5, p_on_sale => $6,
                          p_hide_season => $7, p_sort => $8, p_cursor => $9, p_limit => $10)`,
    [args.type ?? null, args.types ?? null, args.audience ?? null, args.min ?? null, args.max ?? null,
     args.sale ?? false, args.hide ?? null, args.sort ?? "recommended", args.cursor ?? null, args.limit ?? 24]
  ).then((r) => r.rows);

const cursorOf = (sort, row) =>
  sort === "recommended" ? String(row.pos)
  : sort === "discount" ? `${row.discount_pct}|${row.id}`
  : `${row.price}|${row.id}`;

async function walk(db, args) {
  const all = [];
  let cursor = null;
  for (let i = 0; i < 200; i++) {
    const rows = await page(db, { ...args, cursor, limit: 50 });
    if (!rows.length) break;
    all.push(...rows);
    cursor = cursorOf(args.sort ?? "recommended", rows.at(-1));
  }
  return all;
}

test("rebuild copies only what discover shows and swaps the view", async () => {
  const db = await freshDb();
  const n1 = (await db.query(`select rebuild_discover_products() as n`)).rows[0].n;
  const expected = (await db.query(
    `select count(*)::int as n from inspo_products
      where in_stock and giftable and image_url is not null and deep_link is not null and price >= 10`
  )).rows[0].n;
  assert.equal(n1, expected);
  assert.equal((await db.query(`select active from discover_products_state`)).rows[0].active, "b");
  assert.equal((await db.query(`select count(*)::int as n from discover_products`)).rows[0].n, expected);
  // the old copy is freed
  assert.equal((await db.query(`select count(*)::int as n from discover_products_a`)).rows[0].n, 0);

  // a second rebuild goes back to A and picks up feed changes
  await db.exec(`update inspo_products set in_stock = false where id = 'p00001'`);
  await db.query(`select rebuild_discover_products()`);
  assert.equal((await db.query(`select active from discover_products_state`)).rows[0].active, "a");
  assert.equal((await db.query(`select count(*)::int as n from discover_products where id = 'p00001'`)).rows[0].n, 0);
});

test("a collapsed build never replaces a good one", async () => {
  const db = await freshDb();
  await db.query(`select rebuild_discover_products()`);
  const before = (await db.query(`select count(*)::int as n from discover_products`)).rows[0].n;
  await seed(db, 300); // a broken import
  await assert.rejects(db.query(`select rebuild_discover_products()`), /keeping the current table/);
  assert.equal((await db.query(`select count(*)::int as n from discover_products`)).rows[0].n, before);
});

for (const sort of ["recommended", "price_asc", "price_desc", "discount"]) {
  test(`keyset paging (${sort}) returns every row once, in order`, async () => {
    const db = await freshDb();
    await db.query(`select rebuild_discover_products()`);
    const rows = await walk(db, { sort });
    const ids = rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicates");

    const where = sort === "discount" ? "where discount_pct > 0 and discount_pct <= 85" : "";
    const total = (await db.query(`select count(*)::int as n from discover_products ${where}`)).rows[0].n;
    assert.equal(ids.length, total, "no gaps");

    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      if (sort === "recommended") assert.ok(a.pos < b.pos);
      if (sort === "price_asc") assert.ok(Number(a.price) <= Number(b.price));
      if (sort === "price_desc") assert.ok(Number(a.price) >= Number(b.price));
      if (sort === "discount") assert.ok(Number(a.discount_pct) >= Number(b.discount_pct));
    }
  });
}

test("filters: type, types, audience, price, sale, season", async () => {
  const db = await freshDb();
  await db.query(`select rebuild_discover_products()`);
  assert.ok((await page(db, { type: "tech" })).every((r) => r.product_type === "tech"));
  assert.ok((await page(db, { types: ["home", "toys"], limit: 60 })).every((r) => ["home", "toys"].includes(r.product_type)));
  // a single type wins over the list
  assert.ok((await page(db, { type: "beauty", types: ["home"] })).every((r) => r.product_type === "beauty"));
  assert.ok((await page(db, { audience: "her", limit: 60 })).every((r) => r.gender !== "male"));
  assert.ok((await page(db, { audience: "him", limit: 60 })).every((r) => r.gender !== "female"));
  assert.ok((await page(db, { min: 50, max: 100, limit: 60 })).every((r) => r.price >= 50 && r.price <= 100));
  assert.ok((await page(db, { sale: true, limit: 60 })).every((r) => Number(r.discount_pct) > 0));
  assert.ok((await page(db, { hide: "summer", limit: 60 })).every((r) => r.season !== "summer"));
});

test("limit is capped at 60", async () => {
  const db = await freshDb();
  await db.query(`select rebuild_discover_products()`);
  assert.equal((await page(db, { limit: 500 })).length, 60);
});

test("display_name works through the view", async () => {
  const db = await freshDb();
  await db.query(`select rebuild_discover_products()`);
  const { rows } = await db.query(`select p.display_name from discover_page() p limit 1`);
  assert.match(rows[0].display_name, /^Laikrodis Nr\d+ Auksinė$/);
});

test("tables are not reachable by API roles; only the functions are", async () => {
  const db = await freshDb();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
      where table_name like 'discover_products%' and grantee in ('anon', 'authenticated')`
  );
  assert.equal(rows[0].n, 0);
  const rebuild = await db.query(
    `select has_function_privilege('anon', 'rebuild_discover_products()', 'execute') as anon_can,
            has_function_privilege('service_role', 'rebuild_discover_products()', 'execute') as service_can`
  );
  assert.deepEqual(rebuild.rows[0], { anon_can: false, service_can: true });
});
