// Tests for clean_product_name / display_name (T6), on real feed names.
//
//   pnpm test:sql

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

let db;
async function getDb() {
  if (db) return db;
  db = new PGlite();
  await db.exec(read("fixtures/base_schema.sql"));
  await db.exec(`create table public.inspo_products (
    id text primary key, product_name text, brand_name text, merchant_name text)`);
  await db.exec(read("../migrations/20261020140000_product_display_name.sql"));
  return db;
}

async function clean(name, brand, merchant) {
  const d = await getDb();
  const { rows } = await d.query(`select clean_product_name($1, $2, $3) as n`, [name, brand, merchant]);
  return rows[0].n;
}

// [name, brand, merchant, expected]
const CASES = [
  // Modivo: brand + type + model + SKU + colour + fit
  ["Fossil Laikrodis Raquel ES5305 Auksinė", "Fossil", "Modivo LT", "Laikrodis Raquel Auksinė"],
  ["KARL LAGERFELD Pižama B1W45010 Juoda Relaxed Fit", "Karl Lagerfeld", "Modivo LT", "Pižama Juoda"],
  ["Elisabetta Franchi Medžiaginės kelnės PA-132-61E2-V350 Balta Regular Fit", "Elisabetta Franchi", "Modivo LT", "Medžiaginės kelnės Balta"],
  ["Columbia Turistiniai batai Peakfreak Rush™ Mid Waterproof 2108261 Mėlyna", "Columbia", "Modivo LT", "Turistiniai batai Peakfreak Rush™ Mid Waterproof Mėlyna"],
  ["Puma Auliniai batai Evolve 2.0 Boot PS 313809 Juoda", "Puma", "Modivo LT", "Auliniai batai Evolve 2.0 Boot PS Juoda"],
  ["MICHAEL Michael Kors Piniginė Greyson  39F9LGYZ3B Juoda", "MICHAEL Michael Kors", "Modivo LT", "Piniginė Greyson Juoda"],
  ["adidas Bomber striukė adicolor Teamgeist KC8358 Juoda Loose Fit", "Adidas", "Modivo LT", "Bomber striukė adicolor Teamgeist Juoda"],
  ["Guess Kepurė su snapeliu H6YZ12 W2604 Smėlio", "Guess", "Modivo LT", "Kepurė su snapeliu Smėlio"],
  // Eavalyne: type + brand + model + SKU + colour
  ["Rankinė Armani Exchange XW002604 AF19902 UC001 Juoda", "Armani Exchange", "Eavalyne LT", "Rankinė Juoda"],
  ["Basutės Geox J S.Karly G. D J5235D 0HINF C8011 M Rožinė", "Geox", "Eavalyne LT", "Basutės J S.Karly G. D 0HINF Rožinė"],
  ["Pusbačiai Mayoral 43727.15 Balta", "Mayoral", "Eavalyne LT", "Pusbačiai Balta"],
  ["Laikrodis G-Shock GD-010-1A1ER Juoda", "G-SHOCK", "Eavalyne LT", "Laikrodis Juoda"],
  // About You: BRAND + type + 'model' + colour list
  ["NAME IT Apatiniai marškinėliai rausvai violetinė spalva / rožių spalva / burgundiško vyno spalva / balta", "NAME IT", "About You LT", "Apatiniai marškinėliai rausvai violetinė spalva"],
  ["IVY OAK Megztinis 'FIBY' smėlio spalva", "IVY OAK", "About You LT", "Megztinis 'FIBY' smėlio spalva"],
  // Douglas: "Brand - ... 125 ml male", "1 pieces female"
  ["Rituals - Hair Care Collection Hair Care Set - Hydrating Plaukų priežiūros rinkiniai 1 pieces female", "Rituals", "Douglas LT", "Hair Care Collection Hair Care Set - Hydrating Plaukų priežiūros rinkiniai"],
  ["Lacoste - Pour Femme Parfumuotas vanduo 30 ml female", "Lacoste", "Douglas LT", "Pour Femme Parfumuotas vanduo 30 ml"],
  ["Shiseido - Technosatin Gel Lipstick Lūpų dažai 4 g Nr. 413", "Shiseido", "Douglas LT", "Technosatin Gel Lipstick Lūpų dažai 4 g Nr. 413"],
  // 4F: size last; feature numbers stay
  ["4F Vyriškos žygio kelnės 5000 membrana - tamsiai mėlynos XXL", "4F", "4F LT", "Vyriškos žygio kelnės 5000 membrana - tamsiai mėlynos"],
  ["4F Žieminė kepurė mergaitiška - smėlio one size", "4F", "4F LT", "Žieminė kepurė mergaitiška - smėlio"],
  ["4F Dvipusė striukė su sintetinių pūkų kamšalu mergaitėms - juoda 158", "4F", "4F LT", "Dvipusė striukė su sintetinių pūkų kamšalu mergaitėms - juoda"],
  ["4F Vyriški žemi Velocore E-knit sneakers sportbačiai - juodi 44", "4F", "4F LT", "Vyriški žemi Velocore E-knit sneakers sportbačiai - juodi"],
  ["4F Striukė su sintetiniu užpildu vyrams - juoda 3XL", "4F", "4F LT", "Striukė su sintetiniu užpildu vyrams - juoda"],
  ["DC Shoes Sportiniai šortai Millenia ADYFB03075 Pilka Baggy Fit", "DC Shoes", "Modivo LT", "Sportiniai šortai Millenia Pilka"],
  ["Guess Marškinėliai L5RI33 I3Z14 Tamsiai mėlyna Oversize", "Guess", "Eavalyne LT", "Marškinėliai Tamsiai mėlyna"],
  // shop-internal prefixed codes
  ["Lasocki Auliniai batai CEO-WI16-GIRO-08 Juoda", "LASOCKI", "Modivo LT", "Auliniai batai Juoda"],
  ["Auliniai batai G-STAR EO-DEXTER-12 126AM Tamsiai ruda", "G-Star", "Eavalyne LT", "Auliniai batai Tamsiai ruda"],
  // Pigu: brand trimmed, model numbers kept (they are information for tech)
  ["Plaukų tiesintuvas Hausberg HB-202NG, skaitmeninis, 160–220°C, PTC", "Hausberg", "Pigu.lt", "Plaukų tiesintuvas HB-202NG, skaitmeninis, 160–220°C, PTC"],
  ["Tualetinis vanduo Paloma Picasso Paloma Picasso EDT moterims 100 ml", "Paloma Picasso", "Pigu.lt", "Tualetinis vanduo EDT moterims 100 ml"],
  // small shops: untouched unless the brand repeats
  ["Mideer - Magiška grybo formos lempa", "Le kuku", "Le kuku", "Mideer - Magiška grybo formos lempa"],
];

for (const [name, brand, merchant, expected] of CASES) {
  test(`${merchant}: ${name.slice(0, 50)}`, async () => {
    assert.equal(await clean(name, brand, merchant), expected);
  });
}

test("quantities with units are never taken for codes", async () => {
  assert.equal(await clean("Kvepalų rinkinys 100 ml, 100 ml", "X", "Modivo LT"), "Kvepalų rinkinys 100 ml");
  assert.equal(await clean("Dušo durys 190 X 140 Cm", "Rea", "Modivo LT"), "Dušo durys 190 X 140 Cm");
  assert.equal(await clean("Kilimėlis 100000 g", "Rea", "Modivo LT"), "Kilimėlis 100000 g");
});

test("never returns something worse than the original", async () => {
  // a name that is nothing but brand and code falls back to the raw name
  assert.equal(await clean("Guess ES5305", "Guess", "Modivo LT"), "Guess ES5305");
  assert.equal(await clean(null, "X", "Modivo LT"), null);
  assert.equal(await clean("", "X", "Modivo LT"), "");
});

test("display_name works as a computed column", async () => {
  const d = await getDb();
  await d.query(
    `insert into inspo_products values ('p1', 'Fossil Laikrodis Raquel ES5305 Auksinė', 'Fossil', 'Modivo LT')`
  );
  const { rows } = await d.query(`select p.display_name from inspo_products p where id = 'p1'`);
  assert.equal(rows[0].display_name, "Laikrodis Raquel Auksinė");
});
