import { NextResponse } from "next/server";
import { createBearerClient, bearerTokenFrom } from "@/utils/supabase/bearer";
import { addManagedMemberWith } from "@/lib/events/managed";

export const dynamic = "force-dynamic";

/**
 * Add a person by name only, for the mobile app.
 *
 * Creating them needs the service-role key (an anonymous sign-in on a
 * throwaway client, then ss_setup_managed_member, which only service_role may
 * call), so it cannot happen inside the app. This runs exactly what the
 * website's own sheet runs. Who is asking comes from the access token; the
 * body supplies only the event slug and the name.
 */
export async function POST(req: Request) {
  const token = bearerTokenFrom(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: { slug?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const { slug, name } = body;
  if (typeof slug !== "string" || !slug || typeof name !== "string") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await addManagedMemberWith(createBearerClient(token), slug, name);
  if (!result.ok) {
    const status =
      result.error === "not_authenticated"
        ? 401
        : result.error === "not_allowed"
        ? 403
        : result.error === "not_found"
        ? 404
        : result.error === "rate_limited"
        ? 429
        : result.error === "name_required" ||
          result.error === "event_closed" ||
          result.error === "not_draw_type"
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, userId: result.userId, boardId: result.boardId });
}
