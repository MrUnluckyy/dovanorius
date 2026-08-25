import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { signReservationToken } from "@/lib/reservationToken";
import { REMIND_WITHIN_DAYS } from "@/lib/reservationWindow";
import { ReservationReminderEmail } from "@/emails/ReservationReminderEmail";

// Runs daily (Vercel Cron). Reservations do not expire, so this is a check-in
// rather than a warning: around the hold's check-in date we ask the giver once
// whether they still mean to give the gift. Ignoring it keeps the hold — the
// only action offered is releasing it.
//
// This used to filter on `reminder_email is not null` and nothing else, which
// meant it sent no mail at all for its entire life: before the reserve rework,
// that column was only written by an optional prompt shown AFTER reserving, and
// almost nobody filled it in. `reserve_item_with_contact` now records an address
// on every web reservation, but two groups still arrive here without one — holds
// placed before the rework, and mobile reservations, which still go through the
// old `reserve_item`. Most of those reservers are signed in and have had a
// perfectly good address on their account the whole time, so fall back to it.

export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

type ReminderRow = {
  id: string;
  title: string;
  reserved_by: string | null;
  reminder_email: string | null;
  reserve_expires_at: string | null;
  boards: { name: string | null } | { name: string | null }[] | null;
};

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";

  const now = new Date();
  const cutoff = new Date(now.getTime() + REMIND_WITHIN_DAYS * 86400 * 1000);

  const { data: items, error } = await supabaseAdmin
    .from("items")
    .select(
      "id, title, reserved_by, reminder_email, reserve_expires_at, boards(name)"
    )
    .eq("status", "reserved")
    .is("archived_at", null)
    .is("reminder_sent_at", null)
    .lte("reserve_expires_at", cutoff.toISOString())
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("send-reminders query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // One board can have several holds from the same giver; look each account up
  // once. `null` is a cached "this reserver has no usable address".
  const accountEmails = new Map<string, string | null>();

  async function accountEmail(userId: string): Promise<string | null> {
    const cached = accountEmails.get(userId);
    if (cached !== undefined) return cached;

    let resolved: string | null = null;
    try {
      const { data, error: lookupError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      // Anonymous guests carry no address — for them `reminder_email` is the
      // only channel there will ever be, and it is already null here.
      if (!lookupError && data?.user && !data.user.is_anonymous) {
        resolved = data.user.email?.trim() || null;
      }
    } catch (err) {
      console.error(`Account lookup failed for reserver ${userId}:`, err);
    }

    accountEmails.set(userId, resolved);
    return resolved;
  }

  let sent = 0;
  let unreachable = 0;

  for (const item of (items ?? []) as unknown as ReminderRow[]) {
    // An address recorded against this hold beats the account default: someone
    // who asked us to write to a specific inbox meant it.
    const to =
      item.reminder_email?.trim() ||
      (item.reserved_by ? await accountEmail(item.reserved_by) : null);

    if (!to) {
      // Left unmarked on purpose. If this reserver ever signs up, or the mobile
      // app moves to `reserve_item_with_contact`, a later run picks the hold up.
      unreachable++;
      continue;
    }

    try {
      const token = signReservationToken(item.id);
      const boardName = Array.isArray(item.boards)
        ? item.boards[0]?.name
        : item.boards?.name;

      await resend.emails.send({
        from: FROM,
        to,
        subject: "Vis dar planuoji dovanoti? 🎁",
        react: ReservationReminderEmail({
          itemTitle: item.title,
          boardName,
          releaseUrl: `${baseUrl}/r/release/${token}`,
        }),
      });

      // Asked once. `renew_reservation` clears this when the giver revisits
      // their hold, which is the only thing that re-arms the question.
      await supabaseAdmin
        .from("items")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", item.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for item ${item.id}:`, err);
    }
  }

  return NextResponse.json({ checked: items?.length ?? 0, sent, unreachable });
}
