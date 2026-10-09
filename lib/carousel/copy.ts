/**
 * Copy rules for the Instagram carousel. Pure, so both the slide renderer
 * (server) and the admin dialog (client, for the caption) can import it.
 */

import { ltPlural } from "@/lib/lt-plural";

/** Cover + product slides + closing slide must fit Instagram's 10-photo cap. */
export const MAX_PRODUCT_SLIDES = 8;

export function ideasLabel(n: number) {
  return `${n} dovanų ${ltPlural(n, "idėja", "idėjos", "idėjų")}`;
}

/**
 * Prices go stale the day after posting, and these are gift ideas rather than
 * offers — so only ever a rough band, never the shop's number.
 */
export function priceBand(price: number | null): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  if (price < 15) return "iki 15 €";
  if (price < 30) return "15–30 €";
  if (price < 50) return "30–50 €";
  if (price < 100) return "50–100 €";
  if (price < 200) return "100–200 €";
  return "200 € +";
}

/** Feed names run long ("… HD07, Nickel/Copper 386732-01"); cut on a word. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export type CaptionPick = { name: string; brand: string | null };

export function buildCaption(title: string, description: string, picks: CaptionPick[]) {
  const lines = picks.map(
    (p, i) => `${i + 1}. ${clip(p.name, 60)}${p.brand ? ` (${p.brand})` : ""}`
  );
  return [
    `${title} 🎁`,
    description.trim(),
    lines.join("\n"),
    "Visas idėjas rasi noriuto.lt (nuoroda profilyje).\nIšsaugok, kad turėtum po ranka prieš šventes 📌",
    "#dovanuidejos #dovanos #kapadovanoti #dovanaidejos #noriuto",
  ]
    .filter(Boolean)
    .join("\n\n");
}
