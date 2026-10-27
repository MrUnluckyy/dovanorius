import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { captureServer } from "@/lib/analyticsServer";
import { SIGNUP_CONTEXT_COOKIE, parseSignupContext } from "@/lib/signupContext";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";
import {
  claimGuestReservations,
  withClaimedParam,
} from "@/lib/claimGuestReservations";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google lands here for sign-up and sign-in alike. An account created
      // in the last minute is this sign-in's own doing: a sign-up.
      const signedIn = data.user;
      if (signedIn && signedIn.app_metadata?.provider === "google") {
        const isNew = Date.now() - new Date(signedIn.created_at).getTime() < 60_000;
        const ctx = parseSignupContext(
          (await cookies()).get(SIGNUP_CONTEXT_COOKIE)?.value
        );
        // After the redirect is sent: PostHog must not slow down signing in.
        after(() =>
          isNew
            ? captureServer("sign_up", signedIn.id, {
                method: "google",
                ...ctx,
                $set_once: ctx,
              })
            : captureServer("sign_in", signedIn.id, { method: "google" })
        );
      }

      // Same as the password path: guest holds carrying this address come home.
      const claimed = await claimGuestReservations(supabase);
      next = withClaimedParam(next, claimed);

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_WEB_URL}${next}`
        );
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
