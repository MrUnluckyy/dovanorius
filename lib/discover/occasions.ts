/**
 * Occasion pages: /idejos/proga/<slug>. "Kalėdinės dovanos", "Dovanos
 * gimtadienio proga"… are how people search for gifts, both here and on
 * Google, and until now the only seasonal thing on the site was one blog post.
 *
 * Products carry no occasion tags, so an occasion is editorial: which curated
 * collections it leads with, which categories its grid draws from, and an
 * optional budget preset (Secret Santa is a budget). The recipient ("Kam?")
 * narrows it further, reusing the recipient lenses.
 */
import type { RecipientKey } from "./recipients";

export type OccasionKey =
  | "christmas"
  | "secretSanta"
  | "birthday"
  | "nameDay"
  | "anniversary"
  | "housewarming";

export type Occasion = {
  key: OccasionKey;
  /** URL slug: /idejos/proga/<slug>. */
  slug: string;
  /** gift_personas slugs, in display order. Missing or thin ones are skipped. */
  collections: string[];
  /** product_types the grid draws from; null = every gift category. */
  gridTypes: string[] | null;
  /** Budget preset (?price key) when the URL has none. */
  defaultPrice?: string;
  /** Blog post slug for the guide block; falls back to the newest post. */
  guideSlug?: string;
  /** Recipients offered under "Kam?". */
  recipients: RecipientKey[];
  /** Highlighted on the hub between these dates (MM-DD, inclusive). */
  season?: { from: string; to: string };
  /** The date the countdown counts to (MM-DD), if any. */
  countdownTo?: string;
};

/** Every gift category except apparel: default browse is mostly fashion. */
export const GIFT_TYPES = [
  "home", "beauty", "tech", "kitchen", "toys", "sport", "tools", "accessory", "garden", "pets",
];

const PEOPLE: RecipientKey[] = ["woman", "man", "kid", "teen"];

export const OCCASIONS: Occasion[] = [
  {
    key: "christmas",
    slug: "kaledos",
    collections: [
      "silta-ir-jauku", "beauty-gifts", "tech-lover", "cosy-home", "for-kids",
      "kitchen-joy", "small-things", "dovanos-jam", "dovanos-paauglei",
    ],
    gridTypes: null,
    guideSlug: "kaledines-dovanos-paauglei-20-ideju",
    recipients: PEOPLE,
    season: { from: "11-01", to: "12-24" },
    countdownTo: "12-24",
  },
  {
    key: "secretSanta",
    slug: "secret-santa",
    collections: ["under-25", "small-things", "cosy-home", "kitchen-joy", "silta-ir-jauku"],
    gridTypes: null,
    defaultPrice: "under20",
    guideSlug: "secret-santa-dovanos-iki-20-eur",
    recipients: ["woman", "man"],
    season: { from: "11-01", to: "12-20" },
  },
  {
    key: "birthday",
    slug: "gimtadienis",
    collections: [
      "tech-lover", "beauty-gifts", "small-things", "sport-outdoors", "kitchen-joy", "for-kids", "for-makers",
    ],
    gridTypes: null,
    recipients: PEOPLE,
  },
  {
    key: "nameDay",
    slug: "vardadienis",
    collections: ["small-things", "under-25", "cosy-home", "beauty-gifts", "kitchen-joy"],
    gridTypes: null,
    recipients: ["woman", "man", "kid"],
  },
  {
    key: "anniversary",
    slug: "jubiliejus",
    collections: ["beauty-gifts", "small-things", "tech-lover", "kitchen-joy", "cosy-home"],
    gridTypes: null,
    recipients: ["woman", "man", "couple"],
  },
  {
    key: "housewarming",
    slug: "ikurtuves",
    collections: ["cosy-home", "kitchen-joy", "garden-outdoor", "for-makers"],
    gridTypes: ["home", "kitchen", "garden", "tools"],
    recipients: ["couple"],
  },
];

export function occasionFromSlug(slug: string): Occasion | null {
  return OCCASIONS.find((o) => o.slug === slug) ?? null;
}

export function occasionByKey(key: OccasionKey): Occasion {
  return OCCASIONS.find((o) => o.key === key)!;
}

/** "MM-DD" of a date in Lithuania's time zone. */
function mmdd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", month: "2-digit", day: "2-digit" })
    .format(d)
    .replace("/", "-");
}

export function inSeason(o: Occasion, now = new Date()): boolean {
  if (!o.season) return false;
  const today = mmdd(now);
  return today >= o.season.from && today <= o.season.to;
}

/** Whole days until the occasion's countdown date this year; null if none or past. */
export function daysUntil(o: Occasion, now = new Date()): number | null {
  if (!o.countdownTo) return null;
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric" }).format(now));
  const target = Date.UTC(year, Number(o.countdownTo.slice(0, 2)) - 1, Number(o.countdownTo.slice(3)));
  const [m, d] = mmdd(now).split("-").map(Number);
  const today = Date.UTC(year, m - 1, d);
  const days = Math.round((target - today) / 86_400_000);
  return days >= 0 ? days : null;
}

/** In-season occasions first (Christmas before Secret Santa), then the rest. */
export function occasionsForStrip(now = new Date()): Occasion[] {
  return [...OCCASIONS.filter((o) => inSeason(o, now)), ...OCCASIONS.filter((o) => !inSeason(o, now))];
}
