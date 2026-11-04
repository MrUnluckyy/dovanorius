import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { EventAccessEmail } from "@/emails/EventAccessEmail";
import { INVITE_BASE_URL, MAIL_FROM } from "@/lib/events/emailInvite";
import {
  ACCESS_LINK_COOLDOWN_SECONDS,
  ACCESS_LINK_HOURLY_LIMIT,
  ACCESS_LINK_MINUTES,
  EMAIL_RE,
  newAccessToken,
} from "@/lib/events/guestAccess";

type EventRow = { id: string; name: string; event_date: string | null };

async function findEvent(body: {
  slug?: unknown;
  token?: unknown;
}): Promise<EventRow | null> {
  const fields = "id, name, event_date";
  if (typeof body.slug === "string" && body.slug) {
    const { data } = await supabaseAdmin
      .from("ss_events")
      .select(fields)
      .eq("slug", body.slug)
      .maybeSingle();
    return data;
  }
  if (typeof body.token !== "string" || !body.token) return null;

  const { data: byLink } = await supabaseAdmin
    .from("ss_events")
    .select(fields)
    .eq("join_token", body.token)
    .maybeSingle();
  if (byLink) return byLink;

  const { data: invite } = await supabaseAdmin
    .from("ss_event_invites")
    .select("event_id")
    .eq("token", body.token)
    .maybeSingle();
  if (!invite) return null;
  const { data } = await supabaseAdmin
    .from("ss_events")
    .select(fields)
    .eq("id", invite.event_id)
    .maybeSingle();
  return data;
}

async function sendLink(event: EventRow, email: string) {
  const { data: seats, error: resolveError } = await supabaseAdmin.rpc(
    "ss_access_resolve",
    { p_event_id: event.id, p_email: email }
  );
  if (resolveError) throw resolveError;
  if (!seats?.length) return;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await supabaseAdmin
    .from("ss_access_links")
    .select("created_at")
    .eq("event_id", event.id)
    .eq("email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (recentError) throw recentError;

  const rows = recent ?? [];
  const lastAt = rows[0] ? new Date(rows[0].created_at).getTime() : 0;
  if (
    rows.length >= ACCESS_LINK_HOURLY_LIMIT ||
    Date.now() - lastAt < ACCESS_LINK_COOLDOWN_SECONDS * 1000
  ) {
    return;
  }

  const { token, hash } = newAccessToken();
  const { error: insertError } = await supabaseAdmin
    .from("ss_access_links")
    .insert({
      token_hash: hash,
      event_id: event.id,
      email,
      expires_at: new Date(
        Date.now() + ACCESS_LINK_MINUTES * 60 * 1000
      ).toISOString(),
    });
  if (insertError) throw insertError;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `Tavo nuoroda į renginį „${event.name}“`,
    react: EventAccessEmail({
      eventName: event.name,
      eventDate: event.event_date,
      accessUrl: `${INVITE_BASE_URL}/renginiai/prieiga/${token}`,
      minutes: ACCESS_LINK_MINUTES,
    }),
  });
  if (sendError) throw sendError;
}

/**
 * "Send me a link to my event."
 *
 * Answers the same whether or not the address is on the roster, and does the
 * work after responding so timing does not give it away either: otherwise this
 * is a way to test who is in somebody's private event. A real address only ever
 * receives mail at that address, which is what makes the link safe to offer.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  after(async () => {
    try {
      const event = await findEvent(body);
      if (event) await sendLink(event, email);
    } catch (error) {
      // The person has already been told to check their inbox, so this is the
      // only trace a failed send leaves. Reported, or it stays invisible.
      console.error("Event access link failed:", error);
      await supabaseAdmin.from("client_reports").insert({
        kind: "error",
        area: "auth",
        reason: "event_access_link_failed",
        detail: { message: error instanceof Error ? error.message : String(error) },
        path: "/api/events/access",
        contact_email: email,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
