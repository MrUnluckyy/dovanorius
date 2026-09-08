import { NextResponse } from "next/server";
import { createBearerClient, bearerTokenFrom } from "@/utils/supabase/bearer";
import { inviteByEmailWith, joinUrlFor } from "@/lib/events/emailInvite";

export const dynamic = "force-dynamic";

/**
 * E-mail invitations for the mobile app.
 *
 * The app can do everything else about an event itself — it talks to the same
 * database under the same policies — but sending mail needs the Resend key,
 * which cannot ship inside a client. So the one server-side step comes here,
 * and reuses exactly what the website's own invite sheet calls, so a guest gets
 * the same mail and the same link whichever device invited them.
 *
 * Authorisation is the caller's Supabase access token, and the organiser check
 * inside `inviteByEmailWith` is what decides — the request body is not trusted
 * for anything but the slug and the address.
 */
export async function POST(req: Request) {
  const token = bearerTokenFrom(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: { slug?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const { slug, email } = body;
  if (typeof slug !== "string" || !slug || typeof email !== "string" || !email) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await inviteByEmailWith(createBearerClient(token), slug, email);

  if (!result.ok) {
    // The errors the app can act on are told apart by status: a stale session
    // or somebody else's event is not the same as a mistyped address.
    const status =
      result.error === "not_authenticated"
        ? 401
        : result.error === "not_allowed"
        ? 403
        : result.error === "not_found"
        ? 404
        : result.error === "invalid_email"
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    emailSent: result.emailSent,
    invite: {
      id: result.invite.id,
      email: result.invite.email,
      token: result.invite.token,
      created_at: result.invite.created_at,
    },
    joinUrl: joinUrlFor(result.invite.token),
  });
}
