import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";
import {
  AuthEmail,
  type AuthEmailAction,
  type AuthEmailLocale,
} from "@/emails/AuthEmail";

/**
 * Supabase's Send Email hook.
 *
 * Supabase normally sends signup / recovery / email-change mail itself, from a
 * stock template that is English, unbranded and unchangeable from this repo.
 * Pointing the hook here means those emails come from the same React templates
 * as everything else, in the reader's own language.
 *
 * WIRING (Supabase dashboard, Auth -> Hooks -> Send Email):
 *   endpoint  https://noriuto.lt/api/auth/send-email
 *   secret    generated there, then set as SEND_EMAIL_HOOK_SECRET in Vercel
 *
 * ⚠️ This project is shared with the mobile app, so enabling the hook reroutes
 * BOTH apps' auth email at once. If this endpoint fails, Supabase does not fall
 * back to its own sender — signups and resets simply stop. Hence: an unknown
 * action still sends something generic rather than throwing, and any failure is
 * logged loudly.
 */

export const dynamic = "force-dynamic";

const FROM = process.env.RESEND_FROM ?? "Noriuto <labas@noriuto.lt>";

const SUBJECTS: Record<AuthEmailAction, Record<AuthEmailLocale, string>> = {
  signup: {
    lt: "Patvirtink savo el. pašto adresą",
    en: "Confirm your email address",
  },
  recovery: {
    lt: "Naujas slaptažodis Noriuto.lt",
    en: "Reset your Noriuto.lt password",
  },
  email_change: {
    lt: "Patvirtink naują el. pašto adresą",
    en: "Confirm your new email address",
  },
  magiclink: {
    lt: "Tavo prisijungimo nuoroda",
    en: "Your sign-in link",
  },
  invite: {
    lt: "Kvietimas į Noriuto.lt",
    en: "You've been invited to Noriuto.lt",
  },
};

const KNOWN_ACTIONS = new Set<AuthEmailAction>([
  "signup",
  "recovery",
  "email_change",
  "magiclink",
  "invite",
]);

/**
 * Where each link should land once the token has been verified. Supabase's own
 * `redirect_to` is honoured when it is a same-origin path, since that is what
 * the calling code asked for; otherwise each action gets a sensible home.
 */
function destinationFor(
  action: AuthEmailAction,
  redirectTo: string,
  baseUrl: string
): string {
  if (redirectTo) {
    try {
      const url = new URL(redirectTo, baseUrl);
      // /api/auth/callback is the OAuth landing strip: it exchanges a `?code=`
      // and, finding none, sends people to the auth-error page. A link from
      // here has already been verified by /api/auth/confirm and carries no
      // code, so honouring it showed a freshly confirmed signup an error page
      // while it was in fact signing them in. Never route back through it.
      const isOAuthCallback = url.pathname.startsWith("/api/auth/callback");
      if (
        url.origin === new URL(baseUrl).origin &&
        url.pathname !== "/" &&
        !isOAuthCallback
      ) {
        return url.pathname + url.search;
      }
    } catch {
      // Unparseable redirect_to: fall through to the defaults below.
    }
  }

  switch (action) {
    case "recovery":
      return "/reset-password";
    case "email_change":
      return "/account";
    default:
      return "/dashboard";
  }
}

type HookPayload = {
  user: {
    /** The address the account has TODAY. Empty for an anonymous guest. */
    email: string;
    id: string;
    /** `auth.users.email_change` — where a change is heading, once asked for. */
    new_email?: string;
    is_anonymous?: boolean;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    /** Set on an email change: the address currently on the account. */
    old_email?: string;
  };
};

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("SEND_EMAIL_HOOK_SECRET is not set; refusing to send.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers);

  let payload: HookPayload;
  try {
    // The dashboard hands the secret over as `v1,whsec_<base64>`; the library
    // wants the base64 on its own.
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ""));
    payload = wh.verify(body, headers) as HookPayload;
  } catch (err) {
    // Anyone can POST here, so an unverified body is never rendered or sent.
    console.error("Rejected unsigned auth-email hook request:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { user, email_data: data } = payload;

  const rawAction = data.email_action_type as AuthEmailAction;
  const action: AuthEmailAction = KNOWN_ACTIONS.has(rawAction)
    ? rawAction
    : "magiclink";
  if (action !== rawAction) {
    // Better a plainly-worded sign-in link than no email at all: Supabase has
    // no fallback sender once the hook is on.
    console.warn(
      `Unknown email_action_type "${data.email_action_type}"; sent as magiclink.`
    );
  }

  const locale: AuthEmailLocale =
    user.user_metadata?.locale === "en" ? "en" : "lt";

  // Point at our own /api/auth/confirm rather than Supabase's /auth/v1/verify.
  //
  // Supabase's verify endpoint answers with the session in the URL *fragment*
  // (`#access_token=...`), and a fragment never reaches a server — so no route
  // handler can act on it, and @supabase/ssr's browser client ignores it too
  // (it is hardcoded to PKCE, which only looks for `?code=`). That combination
  // is what made every password reset dead-end at "Auth session missing!".
  //
  // /api/auth/confirm calls verifyOtp with the token_hash server-side and sets
  // the session cookies directly. No fragment, no code verifier — so it also
  // works when the link is opened on a different device from the one that
  // requested it, which the PKCE path cannot do.
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";
  const next = destinationFor(action, data.redirect_to, baseUrl);
  const confirmUrl = (tokenHash: string) =>
    `${baseUrl}/api/auth/confirm?` +
    new URLSearchParams({
      token_hash: tokenHash,
      type: data.email_action_type,
      next,
    }).toString();

  // Who this goes to, and with which token.
  //
  // The payload carries the user row as it stands rather than the address the
  // mail is for: `user.email` is what the account has TODAY, and `user.new_email`
  // is where a change is heading. Supabase never puts the recipient in the
  // payload at all — its own source carries a TODO about that — so reading the
  // address off `user.email` sent nothing whatsoever for a guest attaching
  // their FIRST address: an anonymous account has no email, so this route
  // answered 400, and Supabase turns a 400 from a hook into "Invalid payload
  // sent to hook", failing the whole updateUser call. Guests kept their seat
  // but could never recover it, which is the one thing the address was for.
  //
  // A change also folds BOTH halves into this single call, with the token
  // fields crossed over (Supabase flags the mismatch in its own source):
  //   token_hash     + token_new -> the NEW address
  //   token_hash_new + token     -> the address on the account today
  // Only the first arrives when secure email change is off, or when there is
  // no current address to ask — which is exactly the guest case.
  const messages: { to: string; tokenHash: string; token?: string }[] = [];

  if (action === "email_change") {
    if (user.new_email) {
      messages.push({
        to: user.new_email,
        tokenHash: data.token_hash,
        token: data.token_hash_new ? data.token_new : data.token,
      });
    }
    if (data.token_hash_new && user.email) {
      // Secure email change: the address on file has to agree to losing it.
      messages.push({
        to: user.email,
        tokenHash: data.token_hash_new,
        token: data.token,
      });
    }
  } else if (user.email) {
    messages.push({
      to: user.email,
      tokenHash: data.token_hash,
      token: data.token,
    });
  }

  if (messages.length === 0) {
    console.error(
      `No recipient address for auth email (${action}, user ${user.id}).`
    );
    return NextResponse.json({ error: "No recipient" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const message of messages) {
      const { error } = await resend.emails.send({
        from: FROM,
        to: message.to,
        subject: SUBJECTS[action][locale],
        react: AuthEmail({
          action,
          locale,
          actionUrl: confirmUrl(message.tokenHash),
          token: message.token,
        }),
      });

      if (error) throw error;
    }
  } catch (err) {
    // Non-2xx so Supabase surfaces it rather than reporting a silent success.
    console.error(`Auth email (${action}) failed for user ${user.id}:`, err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }

  return NextResponse.json({});
}
