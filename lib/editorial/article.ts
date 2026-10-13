import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClient as createSanityClient } from "next-sanity";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { loadPicks } from "@/app/admin/editorial/_lib/health";
import { priceBand } from "@/lib/carousel/copy";
import { claude } from "@/lib/anthropic/client";

// Server-only: service-role Supabase, Claude credentials and a Sanity write token.

/**
 * An editorial shelf, written up as a blog gift guide.
 *
 * Two steps on purpose. `writeArticle` only drafts the copy, so admin can read
 * it and regenerate before anything leaves the app. `saveArticleDraft` then
 * creates a Sanity *draft* (drafts.<id>) — never a published post. A human
 * reads it in the Studio and presses Publish.
 *
 * The body mirrors the posts written by hand: intro paragraphs, one
 * pteGiftPicks block (display "feature", sponsored), closing paragraphs.
 */

const MODEL = "claude-opus-5-5";
const SITE = "https://www.noriuto.lt";
const STUDIO = "https://noriuto.sanity.studio";
const MAX_PICKS = 12;

export type ArticleProduct = {
  productId: string;
  name: string;
  brand: string | null;
  merchant: string | null;
  productType: string | null;
  curatorNote: string | null;
  imageUrl: string | null;
  price: number | null;
  /** Where the pick links: a network deeplink, or /out for direct partners. */
  url: string;
};

const ArticleSchema = z.object({
  title: z.string().describe("Straipsnio pavadinimas, iki 70 simbolių"),
  slug: z.string().describe("URL dalis: mažosios lotyniškos raidės be diakritikų, žodžiai per brūkšnelį"),
  excerpt: z.string().describe("1–2 sakinių santrauka sąrašui ir dalinimuisi"),
  metaTitle: z.string().describe("SEO pavadinimas, iki 60 simbolių"),
  metaDescription: z.string().describe("SEO aprašymas, 140–160 simbolių"),
  intro: z.array(z.string()).describe("2–3 įvado pastraipos"),
  picks: z
    .array(
      z.object({
        productId: z.string(),
        title: z.string().describe("Trumpas, žmogiškas prekės pavadinimas be kodų ir dydžių"),
        description: z.string().describe("2–3 sakiniai: kam ir kodėl tai gera dovana"),
      })
    )
    .describe("Kiekviena pateikta prekė, ta pačia tvarka"),
  outro: z.array(z.string()).describe("1–2 baigiamosios pastraipos"),
});

export type ArticleCopy = z.infer<typeof ArticleSchema>;
export type ArticleDraft = ArticleCopy & { products: ArticleProduct[]; showPrice: boolean };

const SYSTEM = `Tu esi Noriuto (noriuto.lt) turinio rinkodaros specialistas. Noriuto – norų sąrašų ir dovanų idėjų platforma Lietuvoje: žmonės susikuria norų lentą, ja dalijasi, o artimieji perka tai, ko iš tikrųjų norima.

Rašai dovanų gidą tinklaraščiui iš redakcijos atrinktų prekių.

Balsas:
- Šiltas, draugiškas, praktiškas, kreipiniu „tu“. Kaip draugė, kuri padeda išsirinkti, o ne parduotuvės reklama.
- Natūrali lietuvių kalba, lietuviškos kabutės „…“. Jokių angliškų frazių ar vertimo kalkių.
- Konkretu: kiekvienai prekei paaiškink, kam ji tiks ir kodėl ji gera dovana. Ne specifikacijos ir ne bendros frazės, kurios tiktų bet kam.

Griežtos taisyklės:
- Neišgalvok asmeninių istorijų, artimųjų ar patirčių („mano sesė…“). Rašai Noriuto vardu.
- Nerašyk kainų ir nuolaidų – jos keičiasi.
- Neteik faktų, kurių negalima spręsti iš pavadinimo, prekės ženklo ar kategorijos (medžiagų, matmenų, apdovanojimų).
- Kiekvieną pateiktą prekę įtrauk po vieną kartą, ta pačia tvarka, su tuo pačiu productId.
- Redaktoriaus pastabą apie prekę, jei ji yra, laikyk svarbiausiu nurodymu, kaip ją pristatyti.
- Pabaigoje natūraliai pamink Noriuto norų sąrašą (kad kitą kartą nereikėtų spėlioti), be agresyvaus pardavimo.`;

const sanityWriteToken = () => process.env.SANITY_API_WRITE_TOKEN;
export const canSaveToSanity = () => !!sanityWriteToken();

async function loadShelfProducts(shelfId: string) {
  const { data: shelf } = await supabaseAdmin
    .from("gift_personas")
    .select("id, label_lt, description, kind")
    .eq("id", shelfId)
    .maybeSingle();
  if (!shelf || shelf.kind !== "editorial") throw new Error("Lentyna nerasta.");

  // Dropped products have nowhere to link to; out-of-stock ones are still ideas.
  const picks = ((await loadPicks([shelf.id])).get(shelf.id) ?? [])
    .filter((p) => p.state !== "dropped")
    .slice(0, MAX_PICKS);
  if (!picks.length) throw new Error("Lentynoje nėra prekių.");

  const { data: rows } = await supabaseAdmin
    .from("inspo_products")
    .select("id, deep_link, product_type")
    .in("id", picks.map((p) => p.product_id));
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));

  const products: ArticleProduct[] = picks.flatMap((p) => {
    const row = byId.get(p.product_id);
    if (!row?.deep_link) return [];
    // Network rows already carry a tracked deeplink; direct partners go through
    // /out, which tags the link and logs the click (see app/out/route.ts).
    const url = p.product_id.startsWith("partner:")
      ? `${SITE}/out?u=${encodeURIComponent(row.deep_link)}&p=${encodeURIComponent(p.product_id)}`
      : row.deep_link;
    return [
      {
        productId: p.product_id,
        name: p.product_name ?? p.name_snapshot ?? "",
        brand: p.brand_name,
        merchant: p.merchant_name,
        productType: row.product_type ?? null,
        curatorNote: p.reason,
        imageUrl: p.image_url ?? p.image_snapshot,
        price: p.price,
        url,
      },
    ];
  });

  return { shelf, products };
}

/** Draft the article copy. Nothing is stored. */
export async function writeArticle(
  shelfId: string,
  opts: { angle: string; showPrice: boolean }
): Promise<ArticleDraft> {
  const { shelf, products } = await loadShelfProducts(shelfId);

  const brief = [
    `Lentynos pavadinimas: ${shelf.label_lt}`,
    shelf.description ? `Lentynos aprašymas: ${shelf.description}` : null,
    opts.angle.trim() ? `Redaktoriaus kampas šiam straipsniui: ${opts.angle.trim()}` : null,
    "",
    "Prekės (ta tvarka, kuria turi būti straipsnyje):",
    ...products.map((p, i) =>
      [
        `${i + 1}. productId: ${p.productId}`,
        `   Pavadinimas parduotuvėje: ${p.name}`,
        p.brand ? `   Prekės ženklas: ${p.brand}` : null,
        p.merchant ? `   Parduotuvė: ${p.merchant}` : null,
        p.productType ? `   Kategorija: ${p.productType}` : null,
        p.curatorNote ? `   Redaktoriaus pastaba: ${p.curatorNote}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ]
    .filter((l) => l !== null)
    .join("\n");

  const client = claude();
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // Opus 5.5 defaults to medium; this is customer-facing copy.
    output_config: { effort: "high", format: betaZodOutputFormat(ArticleSchema) },
    // If the model declines, the API retries on the fallback inside the same call.
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    system: SYSTEM,
    messages: [{ role: "user", content: `Parašyk dovanų gidą.\n\n${brief}` }],
  });

  if (res.stop_reason === "refusal") throw new Error("Modelis atsisakė rašyti šį straipsnį.");
  if (res.stop_reason === "max_tokens") throw new Error("Straipsnis per ilgas – pabandykite su mažiau prekių.");
  const copy = res.parsed_output;
  if (!copy) throw new Error("Nepavyko sugeneruoti straipsnio.");

  // Keep the curator's order and drop anything the model invented or skipped.
  const known = new Map(products.map((p) => [p.productId, p]));
  const seen = new Set<string>();
  const picks = copy.picks.filter((p) => known.has(p.productId) && !seen.has(p.productId) && seen.add(p.productId));

  return {
    ...copy,
    slug: toSlug(copy.slug || copy.title),
    picks,
    products: picks.map((p) => known.get(p.productId)!),
    showPrice: opts.showPrice,
  };
}

function toSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const block = (text: string) => ({
  _key: key(),
  _type: "block",
  style: "normal",
  markDefs: [],
  children: [{ _key: key(), _type: "span", marks: [], text }],
});

const lt = <T>(type: string, value: T) => [{ _key: key(), _type: type, language: "lt", value }];

/** Upload a product photo to Sanity's asset store; null if the shop's CDN refuses. */
async function uploadImage(
  sanity: ReturnType<typeof createSanityClient>,
  url: string | null,
  filename: string
) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      // Pigu's CDN refuses requests that don't look like a browser (same as
      // lib/carousel/assets.ts).
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      },
    });
    if (!res.ok) return null;
    const asset = await sanity.assets.upload("image", Buffer.from(await res.arrayBuffer()), {
      filename,
    });
    return { _type: "image", asset: { _type: "reference", _ref: asset._id } };
  } catch {
    return null;
  }
}

/** Create the Sanity draft. Returns the Studio link to review and publish it. */
export async function saveArticleDraft(draft: ArticleDraft): Promise<{ studioUrl: string }> {
  const token = sanityWriteToken();
  if (!token) throw new Error("Trūksta SANITY_API_WRITE_TOKEN – juodraščio išsaugoti negalima.");

  const sanity = createSanityClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-07-01",
    token,
    useCdn: false,
  });

  const images = await Promise.all(
    draft.products.map((p, i) => uploadImage(sanity, p.imageUrl, `${draft.slug}-${i + 1}`))
  );

  const items = draft.picks.map((pick, i) => {
    const product = draft.products[i];
    const band = draft.showPrice ? priceBand(product.price) : null;
    return {
      _key: key(),
      _type: "giftPick",
      title: pick.title,
      description: pick.description,
      url: product.url,
      ...(band ? { price: `~ ${band}` } : {}),
      ...(images[i] ? { image: { ...images[i], alt: pick.title } } : {}),
    };
  });

  const id = crypto.randomUUID();
  await sanity.create({
    // The drafts. prefix is what keeps it out of the published dataset.
    _id: `drafts.${id}`,
    _type: "post",
    title: lt("internationalizedArrayStringValue", draft.title),
    slug: { _type: "slug", current: draft.slug },
    excerpt: lt("internationalizedArrayTextValue", draft.excerpt),
    publishedAt: new Date().toISOString(),
    seo: {
      metaTitle: lt("internationalizedArrayStringValue", draft.metaTitle),
      metaDescription: lt("internationalizedArrayTextValue", draft.metaDescription),
      noIndex: false,
    },
    body: lt("internationalizedArrayBlockContentValue", [
      ...draft.intro.map(block),
      { _key: key(), _type: "pteGiftPicks", display: "feature", sponsored: true, items },
      ...draft.outro.map(block),
    ]),
  });

  return { studioUrl: `${STUDIO}/intent/edit/id=${id};type=post/` };
}
