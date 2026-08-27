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

const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

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

type HookPayload = {
  user: {
    id: string;
    email: string;
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

  // Supabase verifies the token itself; we only assemble the link it expects.
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
    "."
  )[0];
  const actionUrl =
    `https://${projectRef}.supabase.co/auth/v1/verify?` +
    new URLSearchParams({
      token: data.token_hash,
      type: data.email_action_type,
      redirect_to: data.redirect_to,
    }).toString();

  // An email change confirms at the NEW address, which is the one Supabase puts
  // in `user.email` for this hook; `old_email` is where the account is today.
  const to = user.email;
  if (!to) {
    console.error(`No recipient address for auth email (user ${user.id}).`);
    return NextResponse.json({ error: "No recipient" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: SUBJECTS[action][locale],
      react: AuthEmail({ action, locale, actionUrl, token: data.token }),
    });

    if (error) throw error;
  } catch (err) {
    // Non-2xx so Supabase surfaces it rather than reporting a silent success.
    console.error(`Auth email (${action}) failed for user ${user.id}:`, err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }

  return NextResponse.json({});
}
