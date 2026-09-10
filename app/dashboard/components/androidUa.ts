/**
 * Should the Android tester prompt be offered to this visitor?
 *
 * Read from the request's user-agent on the server, so the banner is decided
 * before the page renders rather than appearing and vanishing on the client.
 *
 * The rule is not "Android only" — it is "not the devices we can prove are
 * useless". A desktop UA says nothing about which phone is in someone's
 * pocket, and desktop is where a good share of the audience reads the site, so
 * hiding it there would cost real testers. An iPhone UA is different: that is
 * a definite no, and asking anyway is the noise this check exists to stop.
 *
 * Modern iPads report as Macintosh and so fall through as "maybe". That is the
 * right way to be wrong: an ignorable banner beats a missing one.
 */
export function isAndroidCandidate(userAgent: string | null): boolean {
  if (!userAgent) return true; // No UA to judge by — assume maybe.
  return !/iPhone|iPad|iPod/i.test(userAgent);
}

/** Positively an Android device — used to drop the "do you have one?" framing. */
export function isAndroidDevice(userAgent: string | null): boolean {
  return !!userAgent && /Android/i.test(userAgent);
}
