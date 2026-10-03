import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PARTNER_HOSTNAMES = ["partner.noriuto.lt", "partner.localhost"];

// The bare domain sends visitors to www. This used to be a Vercel domain
// redirect, which also redirected /.well-known/*: Apple and Google fetch the
// app-link files (apple-app-site-association, assetlinks.json) from exactly
// noriuto.lt and don't follow redirects, so links shared as
// https://noriuto.lt/... could never open the app. Done here instead, the
// files are served on the apex as-is (the matcher below never runs on paths
// with a dot, and /.well-known is skipped explicitly as well).
//
// /api/* on the apex must redirect too. Supabase sends people back to
// ${NEXT_PUBLIC_WEB_URL}/api/auth/callback (and /api/auth/confirm), which is
// the apex. The PKCE code verifier cookie lives on www, where sign-in started,
// so a callback run on the apex fails ("code verifier should be non-empty")
// and lands on /auth/auth-code-error. Redirected to www, it has the cookie.
const APEX_HOST = "noriuto.lt";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  // Strip port so partner.localhost:3000 matches too
  const host = hostname.split(":")[0];

  if (host === APEX_HOST && !request.nextUrl.pathname.startsWith("/.well-known/")) {
    const url = request.nextUrl.clone();
    url.host = `www.${APEX_HOST}`;
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // API routes ran without this middleware before the apex rule needed them;
  // keep that: no session refresh, no partner rewrite.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  const isPartnerSubdomain = PARTNER_HOSTNAMES.includes(host);

  if (isPartnerSubdomain) {
    const { pathname, search } = request.nextUrl;

    // Don't double-prefix if the path already starts with /partner
    // (e.g. redirect from layout to /partner/login)
    const rewrittenPath = pathname.startsWith("/partner")
      ? pathname
      : pathname === "/"
      ? "/partner"
      : `/partner${pathname}`;

    const url = request.nextUrl.clone();
    url.pathname = rewrittenPath;

    const rewritten = NextResponse.rewrite(url);

    const sessionResponse = await updateSession(request);
    sessionResponse.cookies.getAll().forEach(({ name, value, ...opts }) => {
      rewritten.cookies.set(name, value, opts as any);
    });

    return rewritten;
  }

  return await updateSession(request);
}

export const config = {
  // api/ is included so the apex redirect above covers it; API routes are
  // passed straight through on every other host.
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
