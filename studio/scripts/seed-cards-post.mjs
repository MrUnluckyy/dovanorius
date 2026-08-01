/**
 * Deletes the old smoke-test posts and seeds one "cards" listicle (gift picks
 * shown as image cards, not a numbered list). Item images are added afterwards
 * with the Sanity AI image tool, so each item carries a stable _key.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-cards-post.mjs`
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "d46477b3",
  dataset: "production",
  apiVersion: "2026-07-01",
  token: process.env.SANITY_AUTH_TOKEN,
  useCdn: false,
});

const key = () => Math.random().toString(36).slice(2, 12);
const i18n = (type, values) =>
  Object.entries(values).map(([k, value]) => ({
    _key: k,
    _type: `internationalizedArray${type}Value`,
    value,
  }));
const para = (text) => ({
  _type: "block",
  _key: key(),
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: key(), text, marks: [] }],
});
const callout = (tone, title, text) => ({
  _type: "pteCallout",
  _key: key(),
  tone,
  title,
  content: [
    { _type: "block", _key: key(), style: "normal", markDefs: [], children: [{ _type: "span", _key: key(), text, marks: [] }] },
  ],
});

const ref = (id) => ({ _type: "reference", _ref: id, _key: key() });
const AUTHOR_ID = "13fe7d45-2351-415a-a46a-6f5c58ce595e"; // Kornelija
const CATEGORY_ID = "category-dovanu-idejos";

// Stable item keys so the image tool can target each card afterwards.
const items = [
  { _key: "it1", title: { lt: "Odinė piniginė", en: "Leather wallet" }, description: { lt: "Klasika, kuri niekada nenusibosta ir tarnauja metų metus.", en: "A classic that never goes out of style and lasts for years." }, price: "25 €", url: "https://example.com/pinigine" },
  { _key: "it2", title: { lt: "Belaidės ausinės", en: "Wireless earbuds" }, description: { lt: "Geras garsas kelionėms ir sportui už protingą kainą.", en: "Good sound for commutes and workouts at a fair price." }, price: "29 €", url: "https://example.com/ausines" },
  { _key: "it3", title: { lt: "Kavos pupelių rinkinys", en: "Coffee bean set" }, description: { lt: "Trys skirtingi skrudinimai kavos mėgėjui.", en: "Three different roasts for the coffee lover." }, price: "18 €", url: "https://example.com/kava" },
  { _key: "it4", title: { lt: "Termosinis puodelis", en: "Insulated travel mug" }, description: { lt: "Karšta kava išlieka karšta visą rytą.", en: "Keeps coffee hot the whole morning." }, price: "20 €", url: "https://example.com/puodelis" },
  { _key: "it5", title: { lt: "Linksmų kojinių rinkinys", en: "Fun socks set" }, description: { lt: "Maža, bet visada praverčia — ir dar prajuokina.", en: "Small but always useful — and good for a laugh." }, price: "15 €", url: "https://example.com/kojines" },
  { _key: "it6", title: { lt: "Daugiafunkcis įrankis", en: "Multi-tool" }, description: { lt: "Kompaktiškas pagalbininkas kišenėje bet kokiai progai.", en: "A compact pocket helper for any occasion." }, price: "22 €", url: "https://example.com/irankis" },
];

const giftPicks = (locale) => ({
  _type: "pteGiftPicks",
  _key: "picks",
  heading: locale === "lt" ? "Mūsų rekomendacijos" : "Our picks",
  display: "cards",
  sponsored: true,
  items: items.map((it) => ({
    _key: it._key,
    _type: "giftPick",
    title: it.title[locale],
    description: it.description[locale],
    price: it.price,
    url: it.url,
  })),
});

const body = (locale) => [
  locale === "lt"
    ? para("Kartais sunkiausia dovaną rasti tam, kuris „viską turi“. Surinkome šešias idėjas iki 30 €, kurios tinka gimtadieniui, šventėms ar tiesiog be progos — praktiškos, bet ne nuobodžios.")
    : para("Sometimes the hardest person to shop for is the one who “has everything”. Here are six ideas under €30 that work for a birthday, the holidays, or no occasion at all — practical but never dull."),
  callout(
    "info",
    locale === "lt" ? "Verta žinoti" : "Worth knowing",
    locale === "lt"
      ? "Nesate tikri dėl skonio? Rinkitės tai, kas suvartojama — kava ar kojinės niekada neguli spintoje."
      : "Unsure about taste? Pick something consumable — coffee or socks never end up gathering dust."
  ),
  giftPicks(locale),
  locale === "lt"
    ? para("Visos idėjos — universalios, tad net jei nepataikysite tiksliai, dovana tikrai nenugulės stalčiuje.")
    : para("Every idea here is versatile, so even a near-miss won't end up forgotten in a drawer."),
];

const OLD_IDS = [
  "sample-post-hello-world",
  "sample-post-blocks-demo",
  "drafts.sample-post-blocks-demo",
  "sample-post-listicle",
  "drafts.sample-post-listicle",
];

const tx = client.transaction();
for (const id of OLD_IDS) tx.delete(id);

tx.createOrReplace({
  _id: "example-cards-vaikinui",
  _type: "post",
  slug: { _type: "slug", current: "6-dovanu-ideju-vaikinui-iki-30-eur" },
  publishedAt: new Date().toISOString(),
  author: ref(AUTHOR_ID),
  categories: [ref(CATEGORY_ID)],
  facets: [ref("facet-vaikinui"), ref("facet-iki-30-eur")],
  title: i18n("String", {
    lt: "6 dovanų idėjos vaikinui iki 30 €",
    en: "6 gift ideas for him under €30",
  }),
  excerpt: i18n("Text", {
    lt: "Praktiškos, bet ne nuobodžios dovanos, kurios tinka bet kuriai progai.",
    en: "Practical but never dull gifts that suit any occasion.",
  }),
  body: i18n("BlockContent", { lt: body("lt"), en: body("en") }),
});

await tx.commit();
console.log("Deleted old samples; seeded /blog/6-dovanu-ideju-vaikinui-iki-30-eur");
