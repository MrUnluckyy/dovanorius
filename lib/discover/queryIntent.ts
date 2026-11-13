/**
 * What a gift search says besides the product: a budget ("kvepalai iki 30
 * eur") and a recipient ("dovana mamai"). Neither is a product word, so
 * searching for them found heaters "iki 20 m²" and anything named "mama".
 * They become a price filter and a link to the recipient's page instead.
 */
import type { RecipientKey } from "./recipients";

export type GiftQuery = {
  /** What is left to search for: the product words. */
  q: string;
  /** "iki 30 eur" -> 30. */
  priceMax: number | null;
  recipient: RecipientKey | null;
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Folded word -> recipient. Only words that mean a person, not a product. */
const RECIPIENT_WORDS: Record<string, RecipientKey> = {
  mamai: "mom", mamytei: "mom", mamos: "mom", motinai: "mom",
  teciui: "man", teveliui: "man", tevui: "man", seneliui: "man",
  vyrui: "man", vyrams: "man", vaikinui: "man", draugui: "man", broliui: "man",
  moteriai: "woman", moterims: "woman", zmonai: "woman", merginai: "woman",
  sesei: "woman", seseriai: "woman", mociutei: "woman", senelei: "woman",
  draugei: "friend", draugems: "friend",
  vaikui: "kid", vaikams: "kid", mergaitei: "kid", berniukui: "kid",
  paaugliui: "teen", paauglei: "teen", paaugliams: "teen",
  kudikiui: "baby", naujagimiui: "baby",
  porai: "couple", poroms: "couple",
  namams: "home",
};

/** Words that only say "a gift" and narrow nothing. */
const FILLER = /^(dovan\w*|ideja|idejos|idej\w*|ka|kokia|kokios|padovanoti|kaledin\w*|kaledom|kaledu|proga|progai)$/;

const PRICE = /(?:^|\s)(?:iki|до|up\s*to|under)\s*(\d{1,4})\s*(?:€|eur\w*|e)?(?=\s|$)/i;

export function parseGiftQuery(input: string): GiftQuery {
  let rest = ` ${input.trim()} `;
  let priceMax: number | null = null;

  const m = PRICE.exec(rest);
  if (m) {
    priceMax = Number(m[1]) || null;
    rest = rest.replace(m[0], " ");
  }

  let recipient: RecipientKey | null = null;
  const kept: string[] = [];
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    const f = fold(word).replace(/[^a-z0-9]/g, "");
    if (!recipient && RECIPIENT_WORDS[f]) {
      recipient = RECIPIENT_WORDS[f];
      continue;
    }
    // Filler only goes when something else carried meaning: "dovanos" alone
    // stays a search.
    if (FILLER.test(f) && (recipient || priceMax || kept.length)) continue;
    kept.push(word);
  }
  // "dovanu idejos mamai": filler before the recipient word was kept above.
  const q = (recipient || priceMax ? kept.filter((w) => !FILLER.test(fold(w))) : kept).join(" ");
  return { q, priceMax, recipient };
}

/** The query without its "iki N €" part, for when a budget chip replaces it. */
export function stripPrice(input: string): string {
  return ` ${input} `.replace(PRICE, " ").replace(/\s+/g, " ").trim();
}
