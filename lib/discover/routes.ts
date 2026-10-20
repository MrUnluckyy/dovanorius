import {
  recipientLens,
  type PartnerGender,
  type RecipientKey,
  type VisitorGender,
} from "./recipients";

/**
 * Discover URLs (decided 20 Oct): recipient first, category inside it.
 *
 *   /discover                    personal home
 *   /discover/<recipient>        "Dovanos moteriai"
 *   /discover/<recipient>/<cat>  "Grožio dovanos moteriai"
 *   /discover/kolekcija/<slug>   one collection
 *
 * Lithuanian slugs, because these pages are meant to rank for the searches
 * people actually type ("dovanos moteriai").
 */
export const RECIPIENT_SLUGS: Record<RecipientKey, string> = {
  self: "sau",
  woman: "moteriai",
  man: "vyrui",
  couple: "porai",
  home: "namams",
  kid: "vaikui",
  teen: "paaugliui",
  baby: "kudikiui",
  partner: "partneriui",
  mom: "mamai",
  friend: "draugei",
};

/** product_type → URL slug. Keys match CATEGORIES in _components/filters. */
export const CATEGORY_SLUGS: Record<string, string> = {
  beauty: "grozis",
  home: "namai",
  kitchen: "virtuve",
  tech: "technika",
  toys: "zaislai",
  tools: "irankiai",
  sport: "sportas",
  garden: "sodas",
  pets: "augintiniai",
  clothing: "drabuziai",
  shoes: "avalyne",
  bag: "rankines",
  accessory: "aksesuarai",
};

const invert = <K extends string>(m: Record<K, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, K>;

const RECIPIENT_BY_SLUG = invert(RECIPIENT_SLUGS);
const CATEGORY_BY_SLUG = invert(CATEGORY_SLUGS);

export function recipientFromSlug(slug: string): RecipientKey | null {
  return RECIPIENT_BY_SLUG[slug] ?? null;
}
export function categoryFromSlug(slug: string): string | null {
  return CATEGORY_BY_SLUG[slug] ?? null;
}

export function discoverHref(recipient?: RecipientKey | null, category?: string | null): string {
  if (!recipient) return "/discover";
  const base = `/discover/${RECIPIENT_SLUGS[recipient]}`;
  return category && CATEGORY_SLUGS[category] ? `${base}/${CATEGORY_SLUGS[category]}` : base;
}

export function collectionHref(slug: string): string {
  return `/discover/kolekcija/${slug}`;
}

/** The tabs in the sticky bar, in order. Mamai/Draugei/Partneriui stay chips. */
export const NAV_RECIPIENTS: RecipientKey[] = [
  "self",
  "woman",
  "man",
  "kid",
  "teen",
  "baby",
  "couple",
  "home",
];

// Packshot-friendly, most giftable categories first; apparel last, because
// model photos neither compose into still lifes nor read as gifts.
const HER = ["beauty", "home", "accessory", "kitchen", "tech", "sport", "bag", "clothing", "shoes"];
const HIM = ["tech", "tools", "sport", "kitchen", "accessory", "home", "bag", "clothing", "shoes"];
const ALL = ["home", "beauty", "tech", "kitchen", "toys", "sport", "tools", "accessory", "garden", "pets", "clothing", "shoes", "bag"];

/** Categories worth offering for a recipient, most giftable first. */
export function categoriesFor(
  recipient: RecipientKey | null,
  gender: VisitorGender,
  partner: PartnerGender = null
): string[] {
  switch (recipient) {
    case "woman":
    case "mom":
    case "friend":
      return HER;
    case "man":
      return HIM;
    case "self":
      return gender === "female" ? HER : gender === "male" ? HIM : ALL;
    case "partner":
      return partner === "female" ? HER : partner === "male" ? HIM : ALL;
    case "kid":
    case "baby":
      return ["toys", "sport", "clothing", "shoes"];
    case "teen":
      return ["tech", "beauty", "sport", "accessory", "toys", "bag", "clothing", "shoes"];
    case "home":
      return ["home", "kitchen", "garden", "tools"];
    case "couple":
      return ["home", "kitchen", "tech", "sport", "garden"];
    default:
      return ALL;
  }
}

/** Is this category part of what a recipient's page offers? */
export function isCategoryFor(recipient: RecipientKey, category: string): boolean {
  return categoriesFor(recipient, null).includes(category) ||
    (recipient === "self" && ALL.includes(category));
}

export { recipientLens };
