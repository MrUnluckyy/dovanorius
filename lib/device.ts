/**
 * Which app store is the one this visitor can actually use?
 *
 * Read from the request user-agent on the server so the answer is baked into
 * the HTML — a store row that reshuffles itself after hydration is worse than
 * one that never knew. `null` is the honest answer for desktop: a laptop UA
 * says nothing about the phone in the reader's pocket, so both stores are
 * offered with neither singled out.
 *
 * Modern iPads report as Macintosh and so fall through to `null`. That is the
 * right way to be wrong: both doors open beats the wrong one lit.
 */
export type Platform = "ios" | "android" | null;

export function devicePlatform(userAgent: string | null): Platform {
  if (!userAgent) return null;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}
