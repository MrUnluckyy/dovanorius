/**
 * Lithuanian cases of a first name, for "Tu dovanoji Tomui" (dative) and
 * "Tomo norai" (genitive). Covers the regular masculine and feminine endings;
 * anything else (foreign names, nicknames, initials) returns null and the
 * caller falls back to wording that needs no case ("Tu dovanoji: Tom").
 * A wrong ending on someone's name is worse than a plainer sentence.
 */

/** The first word of a display name, or null if there is nothing usable. */
export function firstName(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0] ?? "";
  return first.length >= 2 && /\p{L}/u.test(first) ? first : null;
}

// Longest ending first: "-tis" before "-is", "-ius" before "-us".
const DATIVE: [RegExp, string][] = [
  [/tis$/, "čiui"],
  [/dis$/, "džiui"],
  [/ius$/, "iui"],
  [/ys$/, "iui"],
  [/is$/, "iui"],
  [/us$/, "ui"],
  [/as$/, "ui"],
  [/ė$/, "ei"],
  [/a$/, "ai"],
];

const GENITIVE: [RegExp, string][] = [
  [/tis$/, "čio"],
  [/dis$/, "džio"],
  [/ius$/, "iaus"],
  [/ys$/, "io"],
  [/is$/, "io"],
  [/us$/, "aus"],
  [/as$/, "o"],
  [/ė$/, "ės"],
  [/a$/, "os"],
];

function inflect(name: string, rules: [RegExp, string][]): string | null {
  for (const [re, rep] of rules) if (re.test(name)) return name.replace(re, rep);
  return null;
}

export const dative = (name: string) => inflect(name, DATIVE);
export const genitive = (name: string) => inflect(name, GENITIVE);
