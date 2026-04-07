import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PARTNER_HOSTNAMES = ["partner.noriuto.lt", "partner.localhost"];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  // Strip port so partner.localhost:3000 matches too
  const host = hostname.split(":")[0];
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
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
