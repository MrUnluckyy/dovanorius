import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { signReservationToken } from "@/lib/reservationToken";
import { REMIND_WITHIN_DAYS } from "@/lib/reservationWindow";
import { ReservationReminderEmail } from "@/emails/ReservationReminderEmail";

// Runs daily (Vercel Cron). Sends a reminder for reservations that are close to
// expiring, so the reserver can keep or release the hold before it lapses.

export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

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
    .select("id, title, reminder_email, reserve_expires_at, boards(name)")
    .eq("status", "reserved")
    .is("archived_at", null)
    .not("reminder_email", "is", null)
    .is("reminder_sent_at", null)
    .gt("reserve_expires_at", now.toISOString())
    .lte("reserve_expires_at", cutoff.toISOString())
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("send-reminders query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  type ReminderRow = {
    id: string;
    title: string;
    reminder_email: string | null;
    reserve_expires_at: string | null;
    boards: { name: string | null } | { name: string | null }[] | null;
  };

  let sent = 0;
  for (const item of (items ?? []) as unknown as ReminderRow[]) {
    try {
      const token = signReservationToken(item.id);
      const boardName = Array.isArray(item.boards)
        ? item.boards[0]?.name
        : item.boards?.name;

      await resend.emails.send({
        from: FROM,
        to: item.reminder_email as string,
        subject: "Vis dar planuoji dovanoti? 🎁",
        react: ReservationReminderEmail({
          itemTitle: item.title,
          boardName,
          keepUrl: `${baseUrl}/r/keep/${token}`,
          releaseUrl: `${baseUrl}/r/release/${token}`,
        }),
      });

      // Mark as sent so we don't email again before this hold's expiry.
      await supabaseAdmin
        .from("items")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", item.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for item ${item.id}:`, err);
    }
  }

  return NextResponse.json({ checked: items?.length ?? 0, sent });
}
