// Server-side validation + normalisation for partner product uploads.
//
// The partner portal writes go through server actions that call this before
// touching the DB. It is deliberately defensive about types: a caller could hit
// the action directly with arbitrary JSON, so every field is coerced and bounded
// rather than trusted. RLS is still a second gate (partner membership + pending
// status), but content shape/limits are enforced here.

/** Loose input as it arrives from the client (or a hostile caller). */
export type ProductInput = {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  currency?: unknown;
  image_url?: unknown;
  product_url?: unknown;
  sku?: unknown;
  is_active?: unknown;
  min_age?: unknown;
  max_age?: unknown;
  gender?: unknown;
  categories?: unknown;
};

/** Normalised row ready to insert (partner_id + status added by the action). */
export type CleanProduct = {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
  is_active: boolean;
  min_age: number | null;
  max_age: number | null;
  gender: "male" | "female" | null;
  categories: string[];
};

export type ValidateResult =
  | { ok: true; value: CleanProduct }
  | { ok: false; error: string };

export const MAX_BULK = 2000;

const CURRENCIES = new Set(["EUR", "USD", "GBP"]);
const MAX_TITLE = 200;
const MAX_DESC = 4000;
const MAX_SKU = 100;
const MAX_URL = 2048;
const MAX_PRICE = 1_000_000;
const MAX_CATEGORIES = 20;
const MAX_CATEGORY_LEN = 60;

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function cleanText(v: unknown, max: number): string | null {
  const s = asString(v).replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.slice(0, max);
}

function cleanUrl(v: unknown): string | null {
  const s = asString(v).trim();
  if (!s || s.length > MAX_URL) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function cleanPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(asString(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

function cleanAge(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseInt(asString(v), 10);
  if (!Number.isInteger(n) || n < 0 || n > 120) return null;
  return n;
}

function cleanGender(v: unknown): "male" | "female" | null {
  const s = asString(v).toLowerCase().trim();
  return s === "male" || s === "female" ? s : null;
}

function cleanCategories(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of v) {
    const s = asString(c).replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_LEN);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out;
}

export function validateProductInput(input: ProductInput): ValidateResult {
  const title = cleanText(input.title, MAX_TITLE);
  if (!title) return { ok: false, error: "Pavadinimas privalomas." };

  let min_age = cleanAge(input.min_age);
  let max_age = cleanAge(input.max_age);
  // Drop an inverted range rather than silently mislabelling the audience.
  if (min_age != null && max_age != null && min_age > max_age) {
    min_age = null;
    max_age = null;
  }

  const currencyRaw = asString(input.currency).toUpperCase().trim();
  const currency = CURRENCIES.has(currencyRaw) ? currencyRaw : "EUR";

  return {
    ok: true,
    value: {
      title,
      description: cleanText(input.description, MAX_DESC),
      price: cleanPrice(input.price),
      currency,
      image_url: cleanUrl(input.image_url),
      product_url: cleanUrl(input.product_url),
      sku: cleanText(input.sku, MAX_SKU),
      is_active: input.is_active !== false,
      min_age,
      max_age,
      gender: cleanGender(input.gender),
      categories: cleanCategories(input.categories),
    },
  };
}
