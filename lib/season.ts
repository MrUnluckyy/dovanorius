/**
 * Seasonal look. Christmas runs 25 Nov – 6 Jan (Trys Karaliai) and switches
 * itself on and off, so nobody has to remember to undo it in January.
 * NEXT_PUBLIC_SEASON=off|christmas overrides the dates (e.g. to preview).
 */
export function isChristmasSeason(now: Date = new Date()): boolean {
  const forced = process.env.NEXT_PUBLIC_SEASON;
  if (forced === "off") return false;
  if (forced === "christmas") return true;
  const m = now.getMonth(); // 0-based
  const d = now.getDate();
  return (m === 10 && d >= 25) || m === 11 || (m === 0 && d <= 6);
}

/** The mascot in a Santa hat during the season, the yellow beanie otherwise. */
export function logoSrc(now: Date = new Date()): string {
  return isChristmasSeason(now) ? "/assets/dovanorius-santa.png" : "/assets/logo.png";
}
