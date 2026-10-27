// Checks that every pre-2026-10-27 English URL still reaches the right page
// after the move to Lithuanian paths (lib/legacyRoutes.ts).
//
//   node scripts/check-legacy-urls.mjs http://localhost:3005
//   node scripts/check-legacy-urls.mjs https://www.noriuto.lt
//
// Optional sample ids (defaults are harmless placeholders that should still
// redirect, then render a not-found/expired page rather than a 404 route):
//   BOARD_SLUG, BOARD_ID, USER_ID, EVENT_SLUG, SHOP_SLUG

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const env = process.env;
const BOARD_SLUG = env.BOARD_SLUG || "mano-norai-85b98e";
const BOARD_ID = env.BOARD_ID || "00000000-0000-0000-0000-000000000000";
const USER_ID = env.USER_ID || "00000000-0000-0000-0000-000000000000";
const EVENT_SLUG = env.EVENT_SLUG || "renginys-000000";
const SHOP_SLUG = env.SHOP_SLUG || "parduotuve";

// [old URL, where it must end up]. Query strings must survive the redirect.
const CASES = [
  ["/dashboard", "/skydelis"],
  ["/boards", "/lentos"],
  [`/boards/${BOARD_ID}`, `/lentos/${BOARD_ID}`],
  ["/boards/join/tok123", "/lentos/prisijungti/tok123"],
  ["/account", "/paskyra"],
  ["/users", "/zmones"],
  [`/users/${USER_ID}`, `/zmones/${USER_ID}`],
  [`/users/${USER_ID}/${BOARD_SLUG}`, `/zmones/${USER_ID}/${BOARD_SLUG}`],
  ["/events", "/renginiai"],
  ["/events/new", "/renginiai/naujas"],
  ["/events/join/tok123", "/renginiai/prisijungti/tok123"],
  [`/events/${EVENT_SLUG}`, `/renginiai/${EVENT_SLUG}`],
  [`/events/${EVENT_SLUG}/my`, `/renginiai/${EVENT_SLUG}/mano`],
  ["/secret-santa", "/renginiai"],
  [`/secret-santa/${EVENT_SLUG}`, `/renginiai/${EVENT_SLUG}`],
  ["/discover", "/idejos"],
  ["/discover?event=abc", "/idejos?event=abc"],
  ["/discover/browse", "/idejos/visos"],
  [`/discover/shop/${SHOP_SLUG}`, `/idejos/parduotuve/${SHOP_SLUG}`],
  ["/discover/moteriai", "/idejos/moteriai"],
  ["/inspo", "/idejos"],
  ["/login", "/prisijungti"],
  ["/login?next=%2Fdashboard", "/prisijungti?next=%2Fdashboard"],
  ["/register", "/registracija"],
  ["/forgot-password", "/pamirsau-slaptazodi"],
  ["/reset-password", "/naujas-slaptazodis"],
  ["/delete-account", "/istrinti-paskyra"],
];

// Must answer directly, no redirect: share links and untouched areas.
const DIRECT = [`/b/${BOARD_SLUG}`, "/blog", "/", "/partneriams", "/privatumo-politika"];

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`  ✗ ${msg}`);
};

for (const [from, to] of CASES) {
  const res = await fetch(base + from, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  const locPath = loc ? new URL(loc, base).pathname + new URL(loc, base).search : "";
  if (res.status !== 308 || locPath !== to) {
    fail(`${from} → ${res.status} ${locPath || "(no location)"}; expected 308 ${to}`);
    continue;
  }
  // Follow it the rest of the way: the new page itself must exist. Auth-gated
  // pages may bounce a signed-out request to /prisijungti, which is fine.
  const final = await fetch(base + to, { redirect: "follow" });
  const finalPath = new URL(final.url).pathname;
  if (final.status >= 500 || (final.status === 404 && !/[0-9a-f]{8}-|tok123|000000|parduotuve$/.test(to))) {
    fail(`${from} → ${to} → ${final.status} at ${finalPath}`);
  } else {
    console.log(`  ✓ ${from} → ${to} (${final.status}${finalPath !== new URL(base + to).pathname ? ` at ${finalPath}` : ""})`);
  }
}

for (const path of DIRECT) {
  const res = await fetch(base + path, { redirect: "manual" });
  if (res.status !== 200) fail(`${path} → ${res.status}; expected 200 without a redirect`);
  else console.log(`  ✓ ${path} (200, unchanged)`);
}

// System links: auth emails already sitting in inboxes carry the OLD landing
// path in `next`; it must survive the hand-over to the confirm button page.
for (const old of ["/reset-password", "/dashboard", "/account"]) {
  const q = new URLSearchParams({ token_hash: "x", type: "recovery", next: old });
  const res = await fetch(`${base}/api/auth/confirm?${q}`, { redirect: "manual" });
  const loc = new URL(res.headers.get("location") || "/", base);
  if (loc.pathname !== "/auth/confirm" || loc.searchParams.get("next") !== old)
    fail(`auth email next=${old} → ${res.status} ${loc.pathname}${loc.search}`);
  else console.log(`  ✓ auth email next=${old} keeps its landing`);
}

// Status checks on new paths: [path, expected status].
const STATUS = [
  ["/auth/confirm?token_hash=x&type=recovery&next=%2Fnaujas-slaptazodis", 200],
  ["/auth/auth-code-error", 200],
  ["/naujas-slaptazodis", 200],
  ["/idejos/visos", 200],
  ["/idejos/moteriai", 200],
  ["/idejos/nera-tokio-gavejo", 404],
];
for (const [path, want] of STATUS) {
  const res = await fetch(base + path, { redirect: "manual" });
  if (res.status !== want) fail(`${path} → ${res.status}; expected ${want}`);
  else console.log(`  ✓ ${path} (${res.status})`);
}

// Signed-out "my gift" page: streams a shell, then sends to sign-in with a
// return path that must itself exist (it used to say /my, a dead path).
{
  const path = `/renginiai/${EVENT_SLUG}/mano`;
  const html = await (await fetch(base + path)).text();
  const want = `/prisijungti?next=${encodeURIComponent(path)}`;
  if (!html.includes(want)) fail(`${path} signed out does not send to ${want}`);
  else console.log(`  ✓ ${path} signed out → ${want}`);
}

console.log(failed ? `\n${failed} failed` : "\nall legacy URLs OK");
process.exit(failed ? 1 : 0);
