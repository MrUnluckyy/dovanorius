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
// The channel depends on who is holding:
//
//   guest (anonymous)  -> email. They keep no account and no dashboard, so an
//                         email is the only way to reach them at all.
//   account holder     -> an in-app notification. They already have the
//                         dashboard listing their holds and the bell; mailing
//                         them as well is the noise this split exists to stop.
//
// Guests only ever come from the web reserve flow — the mobile app is gated
// behind login — so `is_anonymous` is the exact discriminator. It is read live
// rather than trusted from `reminder_email`, so a guest who has since upgraded
// their session into a real account moves to in-app automatically.

export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

type ReminderRow = {
  id: string;
  title: string;
  board_id: string;
  reserved_by: string | null;
  reminder_email: string | null;
  reserve_expires_at: string | null;
  boards: { name: string | null; slug: string | null } | null;
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
      "id, title, board_id, reserved_by, reminder_email, reserve_expires_at, boards(name, slug)"
    )
    .eq("status", "reserved")
    .is("archived_at", null)
    .is("reminder_sent_at", null)
    .not("reserved_by", "is", null)
    .lte("reserve_expires_at", cutoff.toISOString())
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("send-reminders query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const rows = (items ?? []) as unknown as ReminderRow[];

  // One giver often holds several gifts from the same board; look each account
  // up once rather than per row.
  const isGuest = new Map<string, boolean>();
  const reserverIds = [...new Set(rows.map((r) => r.reserved_by!))];

  for (const id of reserverIds) {
    try {
      const { data, error: lookupError } =
        await supabaseAdmin.auth.admin.getUserById(id);
      if (lookupError || !data?.user) {
        // Unknown reserver: leave the hold alone rather than guess a channel.
        console.error(`Reserver lookup failed for ${id}:`, lookupError);
        continue;
      }
      isGuest.set(id, data.user.is_anonymous === true);
    } catch (err) {
      console.error(`Reserver lookup threw for ${id}:`, err);
    }
  }

  let emailed = 0;
  let notified = 0;
  let skipped = 0;

  /** Marks the hold as asked, so the next run leaves it alone. */
  const markAsked = (itemId: string) =>
    supabaseAdmin
      .from("items")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", itemId);

  for (const item of rows) {
    const reserverId = item.reserved_by!;
    const guest = isGuest.get(reserverId);

    if (guest === undefined) {
      skipped++; // lookup failed above; retried on the next run
      continue;
    }

    const boardName = item.boards?.name ?? null;

    try {
      if (guest) {
        const to = item.reminder_email?.trim();
        if (!to) {
          // A guest with no address cannot be reached by any channel. Left
          // unmarked so it is picked up if one ever appears.
          skipped++;
          continue;
        }

        const token = signReservationToken(item.id);
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

        await markAsked(item.id);
        emailed++;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: reserverId,
            type: "reservation_checkin",
            payload: {
              item_id: item.id,
              item_title: item.title,
              board_id: item.board_id,
              board_name: boardName,
              board_slug: item.boards?.slug ?? null,
            },
          });

        if (insertError) throw insertError;

        await markAsked(item.id);
        notified++;
      }
    } catch (err) {
      console.error(`Check-in failed for item ${item.id}:`, err);
    }
  }

  return NextResponse.json({
    checked: rows.length,
    emailed,
    notified,
    skipped,
  });
}
