/**
 * The site's routes moved from English to Lithuanian paths (2026-10-27).
 * Every old path keeps working: next.config.ts turns each pair into a
 * permanent (308) redirect, query string included, so links in sent emails,
 * bookmarks, search results and the mobile app still land on the right page.
 *
 * More specific prefixes come first — Next uses the first redirect that
 * matches, so "/boards/join" must win over "/boards".
 *
 * Not here on purpose: /b/* (board share links), /blog (indexed posts),
 * /partner and /admin (internal), /api, /auth, /r, /out.
 */
export const LEGACY_ROUTES: ReadonlyArray<readonly [from: string, to: string]> = [
  ["/boards/join", "/lentos/prisijungti"],
  ["/boards", "/lentos"],
  ["/dashboard", "/mano"],
  // The dashboard was /skydelis for a few hours on 2026-10-27; auth emails
  // sent that day land there.
  ["/skydelis", "/mano"],
  ["/account", "/paskyra"],
  ["/users", "/zmones"],
  ["/events/new", "/renginiai/naujas"],
  ["/events/join", "/renginiai/prisijungti"],
  ["/events", "/renginiai"],
  ["/secret-santa", "/renginiai"],
  ["/discover/browse", "/idejos/visos"],
  ["/discover/shop", "/idejos/parduotuve"],
  ["/discover", "/idejos"],
  ["/inspo", "/idejos"],
  ["/login", "/prisijungti"],
  ["/register", "/registracija"],
  ["/forgot-password", "/pamirsau-slaptazodi"],
  ["/reset-password", "/naujas-slaptazodis"],
  ["/delete-account", "/istrinti-paskyra"],
];
