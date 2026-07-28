/**
 * Seeds gift facets and a numbered listicle tagged with them, to smoke-test the
 * taxonomy and ranked gift-picks display. Safe to delete in the Studio.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-facets-demo.mjs`
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

const facets = [
  {
    _id: "facet-vaikinui",
    _type: "giftFacet",
    kind: "recipient",
    slug: { _type: "slug", current: "vaikinui" },
    featured: true,
    order: 10,
    title: i18n("String", { lt: "Dovanos vaikinui", en: "Gifts for him" }),
    intro: i18n("BlockContent", {
      lt: [para("Idėjos, kurios tinka bet kuriai progai.")],
      en: [para("Ideas that work for any occasion.")],
    }),
  },
  {
    _id: "facet-naujagimiui",
    _type: "giftFacet",
    kind: "recipient",
    slug: { _type: "slug", current: "naujagimiui" },
    featured: true,
    order: 20,
    title: i18n("String", { lt: "Dovanos naujagimiui", en: "Gifts for a newborn" }),
  },
  {
    _id: "facet-iki-30-eur",
    _type: "giftFacet",
    kind: "priceBand",
    slug: { _type: "slug", current: "iki-30-eur" },
    featured: true,
    order: 30,
    title: i18n("String", { lt: "Dovanos iki 30 €", en: "Gifts under €30" }),
  },
];

const body = [
  para("Penkios idėjos, patikrintos praktikoje."),
  {
    _type: "pteGiftPicks",
    _key: key(),
    heading: "Mūsų penketukas",
    display: "numbered",
    sponsored: true,
    items: [
      { _key: key(), title: "Odinė piniginė", description: "Klasika, kuri tinka visiems.", price: "25 €", url: "https://example.com/1" },
      { _key: key(), title: "Kavos pupelių rinkinys", description: "Trys skirtingi skrudinimai.", price: "18 €", url: "https://example.com/2" },
      { _key: key(), title: "Belaidės ausinės", description: "Geras garsas už protingą kainą.", price: "29 €", url: "https://example.com/3" },
    ],
  },
];

const tx = facets.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
tx.createOrReplace({
  _id: "sample-post-listicle",
  _type: "post",
  slug: { _type: "slug", current: "5-dovanu-ideju-vaikinui" },
  publishedAt: new Date().toISOString(),
  title: i18n("String", {
    lt: "5 dovanų idėjos vaikinui",
    en: "5 gift ideas for him",
  }),
  excerpt: i18n("Text", {
    lt: "Nuo klasikos iki netikėtų sprendimų.",
    en: "From classics to unexpected picks.",
  }),
  facets: [
    { _type: "reference", _ref: "facet-vaikinui", _key: key() },
    { _type: "reference", _ref: "facet-iki-30-eur", _key: key() },
  ],
  body: i18n("BlockContent", { lt: body, en: body }),
});

await tx.commit();
console.log("Seeded 3 facets + /blog/5-dovanu-ideju-vaikinui");
