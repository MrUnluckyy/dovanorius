import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { AndroidTestersEmail } from "@/emails/AndroidTestersEmail";

/**
 * Mails the Play opt-in link to people who asked for it.
 *
 * This deliberately reads `android_tester_interest` rather than the account
 * list. An earlier version walked every user in the project, which the privacy
 * policy does not permit — it promises these addresses are not used this way.
 * Everyone reached here typed their address into the dashboard prompt for this
 * exact purpose, so the consent question does not arise.
 *
 * Triggered by hand, not on a cron, and a dry run unless asked otherwise. Every
 * address it reports has to go onto the Play Console tester list *before* a
 * real send, or the link tells the reader they have no access.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = process.env.RESEND_FROM ?? "Noriuto <labas@noriuto.lt>";
/** The email invites a reply, so this has to reach a person. */
const REPLY_TO = process.env.ANDROID_TESTERS_REPLY_TO ?? "labas@noriuto.lt";
const SUBJECT = "Nuoroda Noriuto Android programėlei 📱";

/** Resend's lower tiers cap at a couple of requests a second. */
const SEND_GAP_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const optInUrl = process.env.ANDROID_OPT_IN_URL;
  if (!optInUrl) {
    return NextResponse.json(
      { error: "ANDROID_OPT_IN_URL is not set" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  // Opt in to sending rather than out of it: a missing param on a route that
  // sends mail should do nothing.
  const send = url.searchParams.get("send") === "true";

  // Said yes, not yet written to. `invited_at` is what makes a re-run after a
  // partial failure resume instead of mailing the first half twice.
  const { data: rows, error } = await supabaseAdmin
    .from("android_tester_interest")
    .select("user_id, google_email")
    .eq("status", "interested")
    .is("invited_at", null);

  if (error) {
    console.error("android-testers: query failed:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const pending = (rows ?? []).filter(
    (r): r is { user_id: string; google_email: string } => !!r.google_email
  );

  if (!send) {
    return NextResponse.json({
      dryRun: true,
      wouldSend: pending.length,
      // The list to paste into the Play Console tester list before sending.
      emails: pending.map((r) => r.google_email),
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  const failed: string[] = [];

  for (const person of pending) {
    // Resend resolves with { error } instead of throwing on a rejected send.
    // Left unread, `invited_at` would be stamped for a mail that never went
    // out, and this person would sit waiting for a link that never arrives.
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: person.google_email,
      replyTo: REPLY_TO,
      subject: SUBJECT,
      react: AndroidTestersEmail({
        optInUrl,
        accountEmail: person.google_email,
      }),
    });

    if (sendError) {
      console.error(`android-testers: send failed for ${person.user_id}:`, sendError);
      failed.push(person.google_email);
    } else {
      sent++;
      const { error: markError } = await supabaseAdmin
        .from("android_tester_interest")
        .update({
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", person.user_id);
      // A send that cannot be recorded means the next run mails this person
      // again. Loud in the log, and reported back so it can be excluded.
      if (markError) {
        console.error(`android-testers: could not mark ${person.user_id}:`, markError);
      }
    }

    await sleep(SEND_GAP_MS);
  }

  return NextResponse.json({ dryRun: false, sent, failed });
}
