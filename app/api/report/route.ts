import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const AREAS = new Set(["reserve", "auth", "board", "contact", "other"]);
const KINDS = new Set(["error", "report"]);

const MAX_MESSAGE = 2000;
const MAX_DETAIL_KEYS = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FROM = process.env.RESEND_FROM ?? "Noriuto <labas@noriuto.lt>";
const TEAM = process.env.REPORTS_ALERT_TO ?? "labas@noriuto.lt";

/**
 * This endpoint is public, so instant mail is capped: a few messages per
 * person an hour and a ceiling for everyone. Over the cap a message is still
 * saved and still reaches us, just in the hourly digest instead.
 */
async function underEmailCap(userId: string | null): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = supabaseAdmin
    .from("client_reports")
    .select("id", { count: "exact", head: true })
    .eq("area", "contact")
    .gte("created_at", hourAgo);
  const [{ count: all }, mine] = await Promise.all([
    recent,
    userId
      ? supabaseAdmin
          .from("client_reports")
          .select("id", { count: "exact", head: true })
          .eq("area", "contact")
          .eq("user_id", userId)
          .gte("created_at", hourAgo)
      : Promise.resolve({ count: 0 }),
  ]);
  return (all ?? 0) <= 30 && (mine.count ?? 0) <= 5;
}

/**
 * A contact-chat message goes to the inbox now, not in the hourly digest:
 * someone is waiting on the other end. Reply-To is the person, so answering
 * is just pressing reply. Returns whether it went out.
 */
async function emailTeam(row: {
  message: string;
  contactEmail: string | null;
  path: string | null;
  reason: string | null;
  userId: string | null;
  isGuest: boolean | null;
  userAgent: string | null;
}): Promise<boolean> {
  const who = row.contactEmail ?? "be el. pašto — atsakyti negalėsime";
  const lines = [
    row.message,
    "",
    "—",
    `Nuo: ${who}`,
    `Puslapis: ${row.path ?? "?"}`,
    row.reason ? `Atidaryta dėl: ${row.reason}` : null,
    `Paskyra: ${row.userId ? `${row.userId}${row.isGuest ? " (svečias)" : ""}` : "neprisijungęs"}`,
    `Naršyklė: ${row.userAgent ?? "?"}`,
  ].filter((l) => l !== null);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: TEAM,
      replyTo: row.contactEmail ?? undefined,
      subject: `Žinutė iš Noriuto: ${row.message.slice(0, 60).replace(/\s+/g, " ")}`,
      text: lines.join("\n"),
    });
    // The SDK resolves with { error } rather than throwing.
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Contact message: email failed, left for the digest:", err);
    return false;
  }
}

/** Keep a person's own words, but not a novel. */
function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Where client-side failures land — both the silent beacon the app sends when
 * something breaks, and the message a person chooses to leave about it.
 *
 * Written with the admin key because client_reports has RLS on and no
 * policies: a guest must be able to file a report without being able to read
 * anybody else's.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "error";
  const area = typeof body.area === "string" ? body.area : "";
  if (!KINDS.has(kind) || !AREAS.has(area)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = clamp(body.message, MAX_MESSAGE);
  // A report with nothing in it is noise; the beacon already covers the fact
  // that something broke.
  if (kind === "report" && !message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Trust the session for identity, never the payload — same rule as /api/track.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kept for beacons too, not just written reports: a flow that already asked
  // for an address (reserving) should be able to tell that person it failed.
  const contactEmail = clamp(body.contactEmail, 320);
  const detail =
    body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)
      ? Object.fromEntries(
          Object.entries(body.detail as Record<string, unknown>).slice(
            0,
            MAX_DETAIL_KEYS
          )
        )
      : {};

  const row = {
    kind,
    area,
    reason: clamp(body.reason, 120),
    detail,
    path: clamp(body.path, 500),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    user_id: user?.id ?? null,
    is_guest: user ? user.is_anonymous === true : null,
    message,
    contact_email:
      contactEmail && EMAIL_RE.test(contactEmail) ? contactEmail : null,
  };
  const { data: inserted, error } = await supabaseAdmin
    .from("client_reports")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // Log rather than surface: the caller is already handling a failure, and a
    // failed report must not become a second error in front of the user.
    console.error("Failed to record client report:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (area === "contact" && message && (await underEmailCap(row.user_id))) {
    const sent = await emailTeam({
      message,
      contactEmail: row.contact_email,
      path: row.path,
      reason: row.reason,
      userId: row.user_id,
      isGuest: row.is_guest,
      userAgent: row.user_agent,
    });
    // Mark it so the hourly digest doesn't send it again. If this email
    // failed, the row stays unmarked and the digest is the fallback.
    if (sent) {
      await supabaseAdmin
        .from("client_reports")
        .update({ alerted_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }
  }

  return NextResponse.json({ ok: true });
}
