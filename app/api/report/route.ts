import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const AREAS = new Set(["reserve", "auth", "board", "other"]);
const KINDS = new Set(["error", "report"]);

const MAX_MESSAGE = 2000;
const MAX_DETAIL_KEYS = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

  const { error } = await supabaseAdmin.from("client_reports").insert({
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
  });

  if (error) {
    // Log rather than surface: the caller is already handling a failure, and a
    // failed report must not become a second error in front of the user.
    console.error("Failed to record client report:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
