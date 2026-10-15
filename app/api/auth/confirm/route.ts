import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/server";

// Only relative paths. Every auth email routes through here, so an unchecked
// `next` would turn a link we send from our own domain into an open redirect —
// the most credible phishing hop there is. `//evil.com` is protocol-relative
// and would leave the site, so it is rejected too.
function safeNext(requested: string | null): string {
  const next = requested ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Opening the emailed link does NOT spend the token.
 *
 * Mail scanners (Microsoft 365 Safe Links, university and company gateways)
 * open every link in a message before the person does. When this GET called
 * verifyOtp, the scanner used up the one-time token — and for a reset or magic
 * link, got the session — while the person's own click a minute later landed
 * on "link expired". On 2026-10-14 a whole group of @vmu.lt guests hit exactly
 * that. A scanner fetches links; it does not press buttons. So the GET only
 * hands over to a page with a button, and the button's POST below verifies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const params = new URLSearchParams({
    token_hash: searchParams.get("token_hash") ?? "",
    type: searchParams.get("type") ?? "",
    next: safeNext(searchParams.get("next")),
  });
  return NextResponse.redirect(`${origin}/auth/confirm?${params}`);
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const token_hash = form.get("token_hash")?.toString();
  const type = form.get("type")?.toString() as EmailOtpType | undefined;
  const next = safeNext(form.get("next")?.toString() ?? null);

  // 303, not the default 307: a 307 would make the browser repeat the POST
  // against the destination page.
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`, 303);
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`, 303);
}
