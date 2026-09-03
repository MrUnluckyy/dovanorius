import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/utils/supabase/admin";
import {
  ReportsDigestEmail,
  type ReportGroup,
  type ReportMessage,
} from "@/emails/ReportsDigestEmail";

export const dynamic = "force-dynamic";

const FROM = process.env.RESEND_FROM ?? "Noriuto <labas@noriuto.lt>";
/** Where the team reads these. Falls back to the brand address. */
const TO = process.env.REPORTS_ALERT_TO ?? "labas@noriuto.lt";
/** One email can only usefully carry so much; the rest waits for the next run. */
const BATCH = 200;
const MAX_MESSAGES = 20;

/**
 * Hourly: has anything broken since the last run?
 *
 * The table it reads exists because a fifteen-hour outage was found by
 * watching session recordings. A table nobody looks at would have been the
 * same outcome with extra steps — this is the part that does the looking.
 *
 * Rows are marked `alerted_at` rather than selected by a time window, so a
 * late run cannot skip anything and overlapping runs cannot double-send.
 */
export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("client_reports")
    .select("id, kind, area, reason, message, contact_email, path, created_at")
    .is("alerted_at", null)
    .is("handled_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("Reports alert: query failed:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ alerted: 0 });
  }

  const counts = new Map<string, ReportGroup>();
  for (const r of rows) {
    const key = `${r.area}:${r.reason ?? ""}`;
    const g = counts.get(key);
    if (g) g.count += 1;
    else counts.set(key, { area: r.area, reason: r.reason, count: 1 });
  }

  const messages: ReportMessage[] = rows
    .filter((r) => r.kind === "report" && r.message)
    .slice(0, MAX_MESSAGES)
    .map((r) => ({
      message: r.message as string,
      contactEmail: r.contact_email,
      area: r.area,
      path: r.path,
    }));

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `Noriuto: ${rows.length} nauji pranešimai`,
      react: ReportsDigestEmail({
        groups: [...counts.values()].sort((a, b) => b.count - a.count),
        messages,
        adminUrl: `${baseUrl}/admin/reports`,
        since: new Date(rows[0].created_at).toLocaleString("lt-LT"),
      }),
    });
    // The SDK resolves with { error } rather than throwing — the exact trap
    // that let three senders report success for mail that never went out.
    if (sendError) throw sendError;
  } catch (err) {
    // Leave alerted_at unset so the next run retries. Marking them now would
    // silently swallow the one alert that mattered.
    console.error("Reports alert: send failed:", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  const { error: markError } = await supabaseAdmin
    .from("client_reports")
    .update({ alerted_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((r) => r.id)
    );
  if (markError) {
    // The mail is already out; log loudly rather than fail, and accept that
    // the next run may repeat it.
    console.error("Reports alert: failed to mark alerted:", markError);
  }

  return NextResponse.json({ alerted: rows.length, messages: messages.length });
}
