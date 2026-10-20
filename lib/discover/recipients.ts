import type { Audience } from "@/types/inspo";

/**
 * Who the visitor is shopping for, and what that means for the page.
 *
 * Until products carry recipient tags (T8), a recipient maps onto the
 * audience filter plus the curated recipient personas (gift_personas with
 * kind = 'recipient'). See dev-issue-discover-premium 4.9.
 *
 * Keys are stored in profiles.last_recipient; the migration's check
 * constraint lists the same set.
 */
export const RECIPIENT_KEYS = [
  "self",
  "woman",
  "man",
  "couple",
  "home",
  "kid",
  "teen",
  "baby",
  "partner",
  "mom",
  "friend",
] as const;

export type RecipientKey = (typeof RECIPIENT_KEYS)[number];

export function isRecipientKey(v: unknown): v is RecipientKey {
  return typeof v === "string" && (RECIPIENT_KEYS as readonly string[]).includes(v);
}

/** Visitor gender as stored on profiles. "other" is answered but neutral. */
export type VisitorGender = "female" | "male" | "other" | null;

/** "Jai" / "Jam" under Partneriui; null until picked. */
export type PartnerGender = "female" | "male" | null;

export type RecipientLens = {
  audience: Audience;
  /** Recipient persona slugs whose shelves lead the page, in order. */
  personas: string[];
  /** product_type the ideas grid narrows to; null = no category filter. */
  gridType: string | null;
  /** Age group the grid keeps (discover_page p_age_group): kid, teen, adult;
   *  null = no age filter. */
  ageGroup: AgeGroup;
};

export type AgeGroup = "kid" | "teen" | "adult" | null;

const OWN_PERSONA: Record<"female" | "male", string> = {
  female: "woman-30plus",
  male: "man-30plus",
};

/** What a recipient choice does to shelves, ranking and the grid. */
export function recipientLens(
  key: RecipientKey | null,
  gender: VisitorGender,
  partner: PartnerGender = null
): RecipientLens {
  switch (key) {
    case "self":
      return gender === "female" || gender === "male"
        ? { audience: gender === "female" ? "her" : "him", personas: [OWN_PERSONA[gender]], gridType: null, ageGroup: "adult" }
        : { audience: "everyone", personas: [], gridType: null, ageGroup: "adult" };
    case "woman":
    case "mom":
    case "friend":
      return { audience: "her", personas: ["woman-30plus"], gridType: null, ageGroup: "adult" };
    case "man":
      return { audience: "him", personas: ["man-30plus"], gridType: null, ageGroup: "adult" };
    case "partner":
      return partner
        ? { audience: partner === "female" ? "her" : "him", personas: [OWN_PERSONA[partner]], gridType: null, ageGroup: "adult" }
        : { audience: "everyone", personas: [], gridType: null, ageGroup: "adult" };
    case "kid":
      return { audience: "everyone", personas: ["child"], gridType: "toys", ageGroup: "kid" };
    case "teen":
      return { audience: "everyone", personas: ["teen-girl", "teen-boy"], gridType: null, ageGroup: "teen" };
    case "baby":
      return { audience: "everyone", personas: ["baby"], gridType: "toys", ageGroup: "kid" };
    case "home":
      return { audience: "everyone", personas: ["cosy-home"], gridType: "home", ageGroup: null };
    // No persona yet; general products until tags exist (T8).
    case "couple":
      return { audience: "everyone", personas: [], gridType: null, ageGroup: "adult" };
    // no recipient (the discover home): no age filter
    case null:
    default:
      return { audience: "everyone", personas: [], gridType: null, ageGroup: null };
  }
}

/** State 1: eight tiles, 2 columns. */
export const TILE_RECIPIENTS: RecipientKey[] = [
  "woman",
  "man",
  "self",
  "couple",
  "home",
  "kid",
  "teen",
  "baby",
];

/** States 2-3: one chip row; "Kitam…" reveals EXTRA_RECIPIENTS. */
export const CHIP_RECIPIENTS: RecipientKey[] = [
  "self",
  "partner",
  "mom",
  "friend",
  "kid",
];

export const EXTRA_RECIPIENTS: RecipientKey[] = [
  "woman",
  "man",
  "teen",
  "baby",
  "couple",
  "home",
];
