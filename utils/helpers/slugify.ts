// utils/slug.ts

import { v4 as uuidv4 } from "uuid";
/**
 * Generate a URL-safe slug from a string and append a random code for uniqueness.
 *
 * Example:
 *   generateSlug("Šeimos Kalėdos 2025 🎄")
 *   -> "seimos-kaledos-2025-x3f9ab"
 */
export function generateSlug(
  input: string,
  options?: { randomLength?: number }
): string {
  const randomLength = options?.randomLength ?? 6;

  // 1. Normalise & remove diacritics (NFD splits letters + accents)
  const withoutDiacritics = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // strip accent marks

  // 2. Lowercase
  const lower = withoutDiacritics.toLowerCase();

  // 3. Replace anything that's not a-z, 0-9 with a hyphen
  //    (this removes emojis, symbols, and non-latin letters after step 1)
  const alnumAndHyphen = lower.replace(/[^a-z0-9]+/g, "-");

  // 4. Collapse multiple hyphens & trim from ends
  const collapsed = alnumAndHyphen.replace(/-+/g, "-").replace(/^-|-$/g, "");

  // 5. Generate random suffix
  const randomPart = uuidv4().slice(0, randomLength);

  // 6. If collapsed ends up empty (e.g. input was only emojis), just use the random part
  if (!collapsed) {
    return randomPart;
  }

  return `${collapsed}-${randomPart}`;
}

// No 0/o, 1/l/i: codes get read out loud and typed from screenshots.
const BOARD_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A board's share code: /b/k7x2m9pq. Deliberately carries no name, so renaming
 * a board can never leave a stale "/b/dovanos-kaledoms-…" link behind.
 *
 * The database assigns the real one (boards_assign_slug trigger) and ignores
 * what a client sends; this is only the value to send so a board inserted
 * before that migration runs still gets a working link.
 */
export function newBoardCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => BOARD_CODE_ALPHABET[b % BOARD_CODE_ALPHABET.length]).join("");
}
