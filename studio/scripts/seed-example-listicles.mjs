/**
 * Seeds three real-looking listicle posts (child / housewarming / newborn) plus
 * the facets and a category they hang off, so the /blog UI can be reviewed with
 * representative content. All docs are published. Safe to delete in the Studio.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-example-listicles.mjs`
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

const heading = (text) => ({
  _type: "block",
  _key: key(),
  style: "h2",
  markDefs: [],
  children: [{ _type: "span", _key: key(), text, marks: [] }],
});

const callout = (tone, title, text) => ({
  _type: "pteCallout",
  _key: key(),
  tone,
  title,
  content: [
    {
      _type: "block",
      _key: key(),
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: key(), text, marks: [] }],
    },
  ],
});

const giftPicks = (headingText, items) => ({
  _type: "pteGiftPicks",
  _key: key(),
  heading: headingText,
  display: "numbered",
  sponsored: true,
  items: items.map((it) => ({ _key: key(), ...it })),
});

const AUTHOR_ID = "13fe7d45-2351-415a-a46a-6f5c58ce595e"; // Kornelija
const CATEGORY_ID = "category-dovanu-idejos";

// ---- Facets -----------------------------------------------------------------
const facetVaikui = {
  _id: "facet-vaikui",
  _type: "giftFacet",
  kind: "recipient",
  slug: { _type: "slug", current: "vaikui" },
  featured: true,
  order: 15,
  title: i18n("String", { lt: "Dovanos vaikui", en: "Gifts for a child" }),
  intro: i18n("BlockContent", {
    lt: [para("Idėjos, kurios džiugina ir lavina — nuo kūrybos iki judėjimo.")],
    en: [para("Ideas that delight and develop — from crafts to active play.")],
  }),
};

// The įkurtuvės (housewarming) facet already exists and is published; we only
// reference it by id so we don't clobber any content already on it.
const FACET_IKURTUVEMS_ID = "d3856162-3d47-49d6-bc6a-ec782a77a539";
const FACET_NAUJAGIMIUI_ID = "facet-naujagimiui"; // already seeded

const category = {
  _id: CATEGORY_ID,
  _type: "category",
  slug: { _type: "slug", current: "dovanu-idejos" },
  title: i18n("String", { lt: "Dovanų idėjos", en: "Gift ideas" }),
};

// ---- Posts ------------------------------------------------------------------
const ref = (id) => ({ _type: "reference", _ref: id, _key: key() });

const posts = [
  {
    _id: "example-listicle-vaikui",
    slug: "5-dovanos-vaikui",
    facets: ["facet-vaikui"],
    title: {
      lt: "5 dovanos vaikui, kurios tikrai nudžiugins",
      en: "5 gifts for a child that will truly delight",
    },
    excerpt: {
      lt: "Nuo kūrybos rinkinių iki lauko žaidimų — idėjos, kurios ne tik pralinksmina, bet ir lavina.",
      en: "From craft kits to outdoor games — ideas that entertain and develop at once.",
    },
    body: {
      lt: [
        para("Rinktis dovaną vaikui – smagu, bet kartais ir sudėtinga: norisi, kad ji ne tik pradžiugintų iškart, bet ir liktų mėgstama ilgiau nei savaitę. Surinkome penkias idėjas, kurios patinka ir vaikams, ir tėvams."),
        callout("tip", "Patarimas", "Prieš pirkdami pažvelkite, kuo vaikas žaidžia jau dabar – geriausios dovanos pratęsia tai, kas jau įdomu."),
        giftPicks("Mūsų penketukas", [
          { title: "Kūrybos rinkinys", description: "Piešimo ir lipdymo priemonės viename – užtenka ilgam popietės užsiėmimui.", price: "20–25 €", url: "https://example.com/kurybos-rinkinys" },
          { title: "Konstruktorius", description: "Klasika, kuri lavina vaizduotę ir smulkiąją motoriką.", price: "30 €", url: "https://example.com/konstruktorius" },
          { title: "Paveikslėlių knyga", description: "Gera istorija prieš miegą – dovana, kuri skaitoma vėl ir vėl.", price: "12–18 €", url: "https://example.com/knyga" },
          { title: "Lauko žaidimas", description: "Kad energija turėtų kur išsilieti – tinka ir kieme, ir parke.", price: "15 €", url: "https://example.com/lauko-zaidimas" },
          { title: "Stalo žaidimas visai šeimai", description: "Vakaras be ekranų, kurį prisimena visi.", price: "20 €", url: "https://example.com/stalo-zaidimas" },
        ]),
        para("Nesvarbu, kurią idėją pasirinksite – svarbiausia, kad dovana kviestų kurti, judėti ar tyrinėti."),
      ],
      en: [
        para("Choosing a gift for a child is fun, but tricky: you want something that delights right away yet stays a favourite longer than a week. Here are five ideas kids and parents both love."),
        callout("tip", "Tip", "Before you buy, look at what the child already plays with — the best gifts extend something they already enjoy."),
        giftPicks("Our top five", [
          { title: "Craft kit", description: "Drawing and modelling supplies in one — good for a long afternoon.", price: "€20–25", url: "https://example.com/craft-kit" },
          { title: "Building blocks", description: "A classic that grows imagination and fine motor skills.", price: "€30", url: "https://example.com/blocks" },
          { title: "Picture book", description: "A good bedtime story — a gift read again and again.", price: "€12–18", url: "https://example.com/book" },
          { title: "Outdoor game", description: "So all that energy has somewhere to go — yard or park.", price: "€15", url: "https://example.com/outdoor" },
          { title: "Family board game", description: "A screen-free evening everyone remembers.", price: "€20", url: "https://example.com/board-game" },
        ]),
        para("Whichever you pick, the point is a gift that invites making, moving or exploring."),
      ],
    },
  },
  {
    _id: "example-listicle-ikurtuvems",
    slug: "5-dovanos-ikurtuvems",
    facets: [FACET_IKURTUVEMS_ID],
    title: {
      lt: "5 dovanos įkurtuvėms, kurių tikrai reikės",
      en: "5 housewarming gifts they'll actually use",
    },
    excerpt: {
      lt: "Praktiška, jauku ir be dubliavimosi – idėjos naujiems namams, kurios tikrai pravers.",
      en: "Practical, cosy and duplicate-proof — ideas for a new home that earn their place.",
    },
    body: {
      lt: [
        para("Įkurtuvės – proga, kai norisi padovanoti ką nors gražaus ir naudingo vienu metu. Naujuose namuose visada trūksta smulkmenų, kurios daro juos jaukius. Štai penkios dovanos, kurios tikrai pravers."),
        callout("info", "Verta žinoti", "Jei nesate tikri dėl stiliaus, rinkitės neutralias spalvas – jos tinka bet kokiam interjerui."),
        giftPicks("Mūsų penketukas", [
          { title: "Kvapni žvakė", description: "Iškart sukuria jaukumą – saugus pasirinkimas bet kokiems namams.", price: "15–20 €", url: "https://example.com/zvake" },
          { title: "Kokybiškas virtuvės rankšluosčių rinkinys", description: "Kasdienė smulkmena, kurios niekada nebūna per daug.", price: "18 €", url: "https://example.com/ranksluosciai" },
          { title: "Kambarinis augalas", description: "Gyvybės naujuose namuose – nereiklus ir ilgaamžis.", price: "12–25 €", url: "https://example.com/augalas" },
          { title: "Puodelių rinkinys", description: "Rytinei kavai ar svečiams – visada praverčia.", price: "25 €", url: "https://example.com/puodeliai" },
          { title: "Jauki pledas", description: "Vakarams ant sofos – dovana, kurią įvertins iškart.", price: "30 €", url: "https://example.com/pledas" },
        ]),
        para("Maža detalė kartais svarbesnė už brangią dovaną – svarbu, kad ji taptų kasdienės rutinos dalimi."),
      ],
      en: [
        para("A housewarming is a chance to give something beautiful and useful at once. A new home always lacks the small things that make it cosy. Here are five gifts that truly earn their place."),
        callout("info", "Worth knowing", "If you're unsure about their style, go neutral — it fits any interior."),
        giftPicks("Our top five", [
          { title: "Scented candle", description: "Instant cosiness — a safe pick for any home.", price: "€15–20", url: "https://example.com/candle" },
          { title: "Quality kitchen towel set", description: "An everyday item you can never have too many of.", price: "€18", url: "https://example.com/towels" },
          { title: "House plant", description: "Life for a new home — low-maintenance and long-lasting.", price: "€12–25", url: "https://example.com/plant" },
          { title: "Mug set", description: "For morning coffee or guests — always handy.", price: "€25", url: "https://example.com/mugs" },
          { title: "Cosy throw blanket", description: "For evenings on the sofa — appreciated straight away.", price: "€30", url: "https://example.com/throw" },
        ]),
        para("A small detail often beats an expensive gift — what matters is that it becomes part of daily life."),
      ],
    },
  },
  {
    _id: "example-listicle-naujagimiui",
    slug: "5-dovanos-naujagimiui",
    facets: [FACET_NAUJAGIMIUI_ID],
    title: {
      lt: "5 praktiškos dovanos naujagimiui",
      en: "5 practical gifts for a newborn",
    },
    excerpt: {
      lt: "Ne tik mielos, bet ir tikrai reikalingos – idėjos, kurias įvertins ir kūdikis, ir tėvai.",
      en: "Not just cute but genuinely needed — ideas both baby and parents will value.",
    },
    body: {
      lt: [
        para("Naujagimiui dovanų niekada nebūna per daug – bet praktiškos vertinamos labiausiai. Rinkomės tai, kas tikrai pravers pirmaisiais mėnesiais ir palengvins tėvų kasdienybę."),
        callout("tip", "Patarimas", "Rinkitės kiek didesnį dydį (3–6 mėn.) – naujagimiai auga greitai, o mažiausio dydžio drabužėlių dažniausiai jau turima."),
        giftPicks("Mūsų penketukas", [
          { title: "Minkšta antklodė / vystyklas", description: "Šilta, kvėpuojanti ir universali – tinka nuo pirmos dienos.", price: "20 €", url: "https://example.com/antklode" },
          { title: "Medvilninių bodžių rinkinys", description: "Praktiška dovana, kurios prireikia kasdien.", price: "18–25 €", url: "https://example.com/bodziai" },
          { title: "Migdomasis žaisliukas", description: "Padeda nurimti prieš miegą – įvertins ir tėvai.", price: "15 €", url: "https://example.com/zaisliukas" },
          { title: "Vonelės termometras ir priežiūros rinkinys", description: "Smulkmenos, kurių prireikia iškart po grįžimo namo.", price: "22 €", url: "https://example.com/prieziura" },
          { title: "Prisiminimų knyga", description: "Vietos pirmiesiems momentams užrašyti – dovana ateičiai.", price: "20 €", url: "https://example.com/prisiminimu-knyga" },
        ]),
        para("Geriausia dovana naujagimiui – ta, kuri palengvina tėvų dieną ir tarnauja ilgiau nei kelias savaites."),
      ],
      en: [
        para("You can never have too many newborn gifts — but the practical ones are valued most. We picked things that truly help in the first months and make parents' days easier."),
        callout("tip", "Tip", "Go one size up (3–6 months) — newborns grow fast, and the smallest sizes are usually already covered."),
        giftPicks("Our top five", [
          { title: "Soft blanket / swaddle", description: "Warm, breathable and versatile — good from day one.", price: "€20", url: "https://example.com/blanket" },
          { title: "Cotton bodysuit set", description: "A practical gift needed every single day.", price: "€18–25", url: "https://example.com/bodysuits" },
          { title: "Comfort soft toy", description: "Helps settle before sleep — parents will thank you.", price: "€15", url: "https://example.com/soft-toy" },
          { title: "Bath thermometer & care set", description: "The little things needed right after coming home.", price: "€22", url: "https://example.com/care-set" },
          { title: "Memory book", description: "Room to record the first moments — a gift for the future.", price: "€20", url: "https://example.com/memory-book" },
        ]),
        para("The best newborn gift is one that eases a parent's day and lasts longer than a few weeks."),
      ],
    },
  },
];

// ---- Commit -----------------------------------------------------------------
const tx = client.transaction();
tx.createOrReplace(category);
tx.createOrReplace(facetVaikui);

for (const p of posts) {
  tx.createOrReplace({
    _id: p._id,
    _type: "post",
    slug: { _type: "slug", current: p.slug },
    publishedAt: new Date().toISOString(),
    author: ref(AUTHOR_ID),
    categories: [ref(CATEGORY_ID)],
    facets: p.facets.map((id) => ref(id)),
    title: i18n("String", p.title),
    excerpt: i18n("Text", p.excerpt),
    body: i18n("BlockContent", p.body),
  });
}

await tx.commit();
console.log("Seeded category + facet-vaikui + 3 listicle posts:");
for (const p of posts) console.log(`  /blog/${p.slug}`);
