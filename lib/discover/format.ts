const EUR = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "23,90 €" — the Lithuanian way, never "23.9 €". */
export function formatPrice(price: number | null | undefined): string {
  return price == null ? "" : EUR.format(price);
}

/**
 * Feed names repeat the brand and carry merchant noise ("Armani - My Way
 * Parfum Kvepalai 30 ml female", "... 1 pieces", "uniwersalny"). The card
 * already shows the brand, so trim it and the noise here. Display only: the
 * raw name stays for search. The proper fix is display_name in the import (T6).
 */
const TAIL_NOISE =
  /(?:[\s,;-]+(?:female|male|unisex|uniseks|uniwersalny|universalus|universali|1\s*pieces?|1\s*vnt\.?))+\s*$/i;

export function cleanName(name: string, brand?: string | null): string {
  let n = name.trim();
  if (brand) {
    const b = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    n = n.replace(new RegExp(`^${b}\\s*[-–:|]\\s*`, "i"), "");
  }
  n = n.replace(TAIL_NOISE, "");
  return n.charAt(0).toUpperCase() + n.slice(1);
}
