import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format } from "date-fns";
import { lt } from "date-fns/locale";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { signReservationToken } from "@/lib/reservationToken";
import { HOLD_DAYS_MAX } from "@/lib/reservationWindow";
import { ReservationConfirmedEmail } from "@/emails/ReservationConfirmedEmail";

// Confirms a reservation by email, right after it is made. Guests keep no
// account and no dashboard, so this email is their only record of the hold —
// which is exactly what was missing when people came back to a lapsed one.

export const dynamic = "force-dynamic";

const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

/**
 * Only confirm a hold that was just placed. Without this the endpoint would be
 * a way to re-send mail to the reserver's inbox on demand.
 */
const CONFIRM_WINDOW_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  let itemId: string | undefined;
  try {
    ({ itemId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!itemId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: item, error } = await supabaseAdmin
    .from("items")
    .select(
      "id, title, reserved_by, reserved_at, reserve_expires_at, reminder_email, status, boards(name, slug, is_public, share_token)"
    )
    .eq("id", itemId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error("confirm-reservation lookup failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  // Silent no-op rather than an error: the reservation itself succeeded, and
  // the caller has nothing useful to do with a failure here.
  if (
    !item ||
    item.status !== "reserved" ||
    item.reserved_by !== user.id ||
    !item.reminder_email ||
    !item.reserved_at ||
    Date.now() - new Date(item.reserved_at).getTime() > CONFIRM_WINDOW_MS
  ) {
    return NextResponse.json({ sent: false });
  }

  const board = Array.isArray(item.boards) ? item.boards[0] : item.boards;
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";

  // Send them back the way they came in: a published board by its slug, a
  // link-shared one by its token.
  const boardUrl = board?.is_public && board?.slug
    ? `${baseUrl}/b/${board.slug}`
    : board?.share_token
    ? `${baseUrl}/b/s/${board.share_token}`
    : null;

  const expiryLabel = item.reserve_expires_at
    ? format(new Date(item.reserve_expires_at), "PPP", { locale: lt })
    : "";

  try {
    const token = signReservationToken(item.id, HOLD_DAYS_MAX);
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: item.reminder_email,
      subject: "Dovana rezervuota 🎁",
      react: ReservationConfirmedEmail({
        itemTitle: item.title,
        boardName: board?.name,
        boardUrl,
        releaseUrl: `${baseUrl}/r/release/${token}`,
        expiryLabel,
      }),
    });
  } catch (err) {
    console.error(`Failed to confirm reservation ${item.id}:`, err);
    return NextResponse.json({ sent: false }, { status: 200 });
  }

  return NextResponse.json({ sent: true });
}
