import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { hashAccessToken } from "@/lib/events/guestAccess";

/**
 * Turn the guest's seat into something a second device can sign in to.
 *
 * Supabase has no way to resume an anonymous user elsewhere: a session can only
 * be minted for a user with an address. So the address, just proven by this
 * click, goes on the same uid. Supabase then counts them as permanent, and
 * handle_new_user publishes a profile and a board, which somebody who declined
 * an account never asked for, so those are put back to private.
 */
async function attachAddress(userId: string, email: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    user_metadata: { guest_link: true },
  });
  if (error) throw error;

  await supabaseAdmin.from("profiles").update({ public: false }).eq("id", userId);
  await supabaseAdmin
    .from("boards")
    .update({ is_public: false })
    .eq("owner_id", userId);
}

/**
 * POST on purpose: mail scanners open every link in a message, and a GET that
 * spent the token would hand them the session while the person's own click
 * failed, as happened to a whole group on 2026-10-14. See /api/auth/confirm.
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const token = form.get("token")?.toString() ?? "";
  const back = `${origin}/renginiai/prieiga/${encodeURIComponent(token)}`;
  if (!token) return NextResponse.redirect(`${origin}/renginiai`, 303);

  try {
    // Spending and checking in one statement, so a double click cannot both win.
    const { data: link } = await supabaseAdmin
      .from("ss_access_links")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", hashAccessToken(token))
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("event_id, email")
      .maybeSingle();
    if (!link) return NextResponse.redirect(back, 303);

    // Asked again rather than remembered: they may have been removed, or made
    // an account, since the mail went out.
    const { data: seats, error: resolveError } = await supabaseAdmin.rpc(
      "ss_access_resolve",
      { p_event_id: link.event_id, p_email: link.email }
    );
    if (resolveError) throw resolveError;
    const seat = seats?.[0] as
      | { user_id: string; is_guest: boolean }
      | undefined;
    if (!seat) return NextResponse.redirect(back, 303);

    if (seat.is_guest) await attachAddress(seat.user_id, link.email);

    const { data: generated, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: link.email,
      });
    if (linkError) throw linkError;

    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: generated.properties.hashed_token,
    });
    if (verifyError) throw verifyError;

    await supabase.rpc("claim_guest_event_seats");

    const { data: event } = await supabaseAdmin
      .from("ss_events")
      .select("slug")
      .eq("id", link.event_id)
      .maybeSingle();
    return NextResponse.redirect(
      event ? `${origin}/renginiai/${event.slug}` : `${origin}/renginiai`,
      303
    );
  } catch (error) {
    console.error("Opening event access link failed:", error);
    await supabaseAdmin.from("client_reports").insert({
      kind: "error",
      area: "auth",
      reason: "event_access_open_failed",
      detail: { message: error instanceof Error ? error.message : String(error) },
      path: "/api/events/access/open",
    });
    return NextResponse.redirect(back, 303);
  }
}
