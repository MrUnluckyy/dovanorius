/**
 * Relevance classification for discover-feed filtering.
 *
 * Supersedes the keyword backfill in 20260724100000_inspo_relevance.sql: gender
 * and product_type now come from the feed's own fields (AWIN
 * `Fashion:suitable_for` and `merchant_category`) instead of being guessed out
 * of a product_name that had the gender token mashed into it. Season has no
 * standard feed field, so it stays keyword-derived from the name.
 */
import type { NormalizedProduct } from "./types";

/** Map a feed "suitable for" value (Womens/Mens/Unisex/…) to our gender enum. */
export function classifyGender(
  suitableFor: string | null | undefined,
  productName: string
): NormalizedProduct["gender"] {
  const s = (suitableFor ?? "").toLowerCase();
  if (/\bunisex\b/.test(s)) return "unisex";
  if (/\b(women|woman|female|girl|ladies|lady)\b/.test(s)) return "female";
  if (/\b(men|man|male|boy)\b/.test(s)) return "male";

  // No usable source field — fall back to unambiguous name cues (LT + EN).
  const n = productName.toLowerCase();
  if (/\bunisex\b/.test(n)) return "unisex";
  if (
    /(suknel|liemenėl|braletė|sijon|palaidin|nėrini|lūp[ųu] daž|blakstien|makiaž|skaist|pudr[aos])/.test(n) ||
    /\b(female|women|womens)\b/.test(n)
  )
    return "female";
  if (/\b(vyr|vyriš|vyrams|male|mens)\b/.test(n)) return "male";
  return null;
}

/** Map a feed category + product name to our coarse product_type buckets. */
export function classifyProductType(
  categoryName: string | null | undefined,
  merchantName: string | null | undefined,
  productName: string
): string {
  const hay = `${categoryName ?? ""} ${productName}`.toLowerCase();
  if (
    (merchantName ?? "").toLowerCase().includes("douglas") ||
    // NB: `krem(as|ai|ą|u|el)` matches the cosmetic (kremas/kremai/kremelis) but
    // NOT the colour "kreminė" (cream-coloured) — that false match was tagging
    // cream-coloured clothing/shoes as beauty.
    /(kvepal|lūp|akių|veido|plaukų|krem(as|ai|ą|u|el)|parfum|makiaž|\btuš|pudr|dažai|beauty|cosmetic|fragrance|perfume)/.test(hay)
  )
    return "beauty";
  if (/(bat[aųiø]|sneaker|krosov|aulini|sandal|šlepet|loafer|mokasin|shoe|boot)/.test(hay))
    return "shoes";
  if (/(rankinė|kuprinė|krepšy|piniginė|\bbag\b|backpack|wallet|handbag)/.test(hay))
    return "bag";
  if (
    /(suknel|kelnės|džins|striuk|palaidin|marškin|megztin|sijon|liemenėl|\bpaltas\b|švark|kostium|džemper|dress|shirt|jean|jacket|coat|sweater|trouser|skirt)/.test(hay)
  )
    return "clothing";
  if (/(kepur|šalik|pirštin|diržas|kaklaraišt|akiniai|laikrod|\bhat\b|scarf|glove|belt|watch|sunglass)/.test(hay))
    return "accessory";
  return "other";
}

/** Season from the product name (no standard feed field for it). */
export function classifySeason(productName: string): NormalizedProduct["season"] {
  const n = productName.toLowerCase();
  if (/(sniego|žiem|auliniai|kailin|pašiltint|\bpaltas\b|winter)/.test(n)) return "winter";
  if (/(sandal|šlepet|basut|maudym|\bvasar|bikin|summer)/.test(n)) return "summer";
  return "all";
}
