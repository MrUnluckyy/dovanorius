/**
 * Seeds one editorial "feature" listicle: each pick is a full section with a
 * cover, title, a longer blurb and a single link (display: "feature"). Item
 * images are added afterwards with the Sanity AI image tool, so each item
 * carries a stable _key. Also creates the "mamai" recipient facet.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-feature-post.mjs`
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

const facetMamai = {
  _id: "facet-mamai",
  _type: "giftFacet",
  kind: "recipient",
  slug: { _type: "slug", current: "mamai" },
  featured: true,
  order: 12,
  title: i18n("String", { lt: "Dovanos mamai", en: "Gifts for mum" }),
  intro: i18n("BlockContent", {
    lt: [para("Jaukios, apgalvotos dovanos, kurios pasako „ačiū“ be žodžių.")],
    en: [para("Cosy, thoughtful gifts that say “thank you” without words.")],
  }),
};

// Stable keys so the image tool can target each section afterwards.
const items = [
  {
    _key: "it1",
    title: { lt: "Šilkinis pagalvės užvalkalas", en: "Silk pillowcase" },
    price: "28 €",
    url: "https://example.com/silkas",
    description: {
      lt: "Maža prabanga, kurią mama pajus kiekvieną vakarą. Šilkas švelnesnis odai ir plaukams nei įprasta medvilnė, o gulantis vėsus prisilietimas tiesiog ramina. Tokia dovana atrodo brangesnė, nei kainuoja, ir ilgai primena tave.",
      en: "A small luxury she'll feel every evening. Silk is gentler on skin and hair than cotton, and its cool touch is quietly soothing. It looks more expensive than it is, and keeps reminding her of you.",
    },
  },
  {
    _key: "it2",
    title: { lt: "Arbatų degustacijos rinkinys", en: "Tea tasting set" },
    price: "20 €",
    url: "https://example.com/arbatos",
    description: {
      lt: "Rytinei ramybei ar popietės pertraukai. Rinkinyje – keli skirtingi skoniai, tad kiekviena diena gali prasidėti šiek tiek kitaip. Puiki dovana tai, kuri mėgsta neskubrias akimirkas su puodeliu rankose.",
      en: "For a calm morning or an afternoon pause. The set holds a few different blends, so each day can start a little differently. A lovely gift for anyone who treasures unhurried moments with a warm cup in hand.",
    },
  },
  {
    _key: "it3",
    title: { lt: "Sojų vaško žvakė", en: "Soy wax candle" },
    price: "18 €",
    url: "https://example.com/zvake",
    description: {
      lt: "Šiltas kvapas, kuris namus paverčia jaukesniais per kelias minutes. Sojų vaškas dega ilgiau ir švariau nei parafinas, o subtilus aromatas netrukdo net jautresnei nosiai. Saugus pasirinkimas, kuris tinka bet kokiam interjerui.",
      en: "A warm scent that makes a home cosier within minutes. Soy wax burns longer and cleaner than paraffin, and the subtle aroma won't overwhelm even a sensitive nose. A safe choice that suits any interior.",
    },
  },
  {
    _key: "it4",
    title: { lt: "Knyga, apie kurią kalbama", en: "The book everyone's reading" },
    price: "15 €",
    url: "https://example.com/knyga",
    description: {
      lt: "Gera knyga – dovana, kuri lieka ilgiau nei vakarą. Rinkitės tai, apie ką pastaruoju metu daug kalbama, arba autorių, kurį mama jau mėgsta. Nedidelis atvirukas su keliais žodžiais viduje šią dovaną paverčia asmeniška.",
      en: "A good book is a gift that outlasts the evening. Pick something people are talking about lately, or an author she already loves. A short handwritten note tucked inside turns it into something personal.",
    },
  },
  {
    _key: "it5",
    title: { lt: "Namų SPA rinkinys", en: "Home spa set" },
    price: "25 €",
    url: "https://example.com/spa",
    description: {
      lt: "Vakaras be skubos, tik sau. Vonios druska, kūno aliejus ir švelnus muilas – viskas, ko reikia, kad įprasta popietė virstų mažomis atostogomis. Dovana, kuri primena mamai pasirūpinti ir savimi.",
      en: "An unhurried evening, just for her. Bath salts, body oil and a gentle soap — everything needed to turn an ordinary afternoon into a small holiday. A gift that reminds her to look after herself too.",
    },
  },
];

const giftPicks = (locale) => ({
  _type: "pteGiftPicks",
  _key: "picks",
  heading: locale === "lt" ? "Penkios idėjos" : "Five ideas",
  display: "feature",
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
    ? para("Geriausios dovanos mamai retai būna pačios brangiausios — dažniau tai smulkmenos, kurios pasako „pagalvojau apie tave“. Surinkome penkias jaukias idėjas ir prie kiekvienos parašėme, kodėl ji tinka ir kam labiausiai patiks.")
    : para("The best gifts for mum are rarely the most expensive — more often they're the small things that say “I thought of you”. Here are five cosy ideas, each with a note on why it works and who it suits best."),
  callout(
    "tip",
    locale === "lt" ? "Patarimas" : "Tip",
    locale === "lt"
      ? "Pridėkite ranka rašytą atviruką — net paprasčiausia dovana su keliais nuoširdžiais žodžiais tampa asmeniška."
      : "Add a handwritten note — even the simplest gift becomes personal with a few heartfelt words."
  ),
  giftPicks(locale),
  locale === "lt"
    ? para("Kad ir kurią idėją pasirinktumėte, svarbiausia – dėmesys. Būtent jis paverčia dovaną prisiminimu.")
    : para("Whichever idea you choose, what matters is the thought behind it — that's what turns a gift into a memory."),
];

const tx = client.transaction();
tx.createOrReplace(facetMamai);
tx.createOrReplace({
  _id: "example-feature-mamai",
  _type: "post",
  slug: { _type: "slug", current: "5-jaukiu-dovanu-mamai" },
  publishedAt: new Date().toISOString(),
  author: ref(AUTHOR_ID),
  categories: [ref(CATEGORY_ID)],
  facets: [ref("facet-mamai")],
  title: i18n("String", {
    lt: "5 jaukios dovanos mamai",
    en: "5 cosy gifts for mum",
  }),
  excerpt: i18n("Text", {
    lt: "Apgalvotos, jaukios idėjos, kurios pasako „ačiū“ be žodžių.",
    en: "Thoughtful, cosy ideas that say “thank you” without words.",
  }),
  body: i18n("BlockContent", { lt: body("lt"), en: body("en") }),
});

await tx.commit();
console.log("Seeded facet-mamai + /blog/5-jaukiu-dovanu-mamai (feature layout)");
