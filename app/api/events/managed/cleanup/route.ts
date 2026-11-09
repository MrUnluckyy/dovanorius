import { NextResponse } from "next/server";
import { createBearerClient, bearerTokenFrom } from "@/utils/supabase/bearer";
import { cleanUpManagedUser } from "@/lib/events/managedCleanup";

export const dynamic = "force-dynamic";

/**
 * Kept for noriuto-app's feat/managed-participants branch, which calls it.
 * Since 20261109120000 the ss_members_cleanup_managed trigger already deleted
 * the person by the time this runs, so it is a no-op; drop it once the app
 * stops calling.
 *
 * After the app removes a member, delete them if they were a managed person
 * who is now in no event (with their wish list), the same as the website's
 * removeMember does. The app removes the ss_members row itself under RLS;
 * only this last step needs the service-role key.
 *
 * Only that person's manager may ask: managed_users is readable by the
 * manager alone (RLS), so the caller's own client finding the row is the
 * check. cleanUpManagedUser then refuses anyone still in an event or not
 * anonymous.
 */
export async function POST(req: Request) {
  const token = bearerTokenFrom(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const { userId } = body;
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const caller = createBearerClient(token);
  const { data: managed } = await caller
    .from("managed_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Not theirs, or not managed at all: nothing to do, and nothing to reveal.
  if (!managed) return NextResponse.json({ ok: true, deleted: false });

  await cleanUpManagedUser(userId);
  return NextResponse.json({ ok: true });
}
