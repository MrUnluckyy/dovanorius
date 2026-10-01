"use server";

import { createClient } from "@/utils/supabase/server";

export type DrawResult =
  | { ok: true; count: number }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "not_allowed"
        | "not_draw_type"
        | "wrong_status"
        | "too_few"
        // Why a draw is impossible, from ss_check_draw's reasons:
        | "no_recipient"
        | "household_too_big"
        | "impossible_other"
        // Kept for callers still matching on it; the RPC reports one of the
        // three reasons above instead.
        | "impossible_exclusions"
        | "failed";
    };

const KNOWN_ERRORS = new Set<string>([
  "not_authenticated",
  "not_found",
  "not_allowed",
  "not_draw_type",
  "wrong_status",
  "too_few",
  "no_recipient",
  "household_too_big",
  "impossible_other",
]);

/**
 * Draw names for an event.
 *
 * The draw itself is ss_run_draw() in the database (migration
 * 20261001120000), shared with noriuto-app: it checks the organiser, locks the
 * event, solves the draw (exclusions, and avoiding last year's pairs), writes
 * ss_draws + ss_assignments + status in one transaction, and retires pending
 * invitations. It used to run here in JS as three separate writes.
 *
 * Returns its failures instead of throwing them: Next.js redacts errors thrown
 * from a Server Action in production, so a thrown message never reaches the
 * client.
 */
export async function runDraw(slug: string): Promise<DrawResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: ev, error: e1 } = await supabase
    .from("ss_events")
    .select("id")
    .eq("slug", slug)
    .single();
  if (e1 || !ev) return { ok: false, error: "not_found" };

  const { data, error } = await supabase.rpc("ss_run_draw", { p_event_id: ev.id });
  if (error || !data) {
    console.error("ss_run_draw failed:", error);
    return { ok: false, error: "failed" };
  }

  const res = data as { ok: boolean; error?: string; count?: number };
  if (res.ok) return { ok: true, count: res.count ?? 0 };

  if (res.error && KNOWN_ERRORS.has(res.error)) {
    return { ok: false, error: res.error as Exclude<DrawResult, { ok: true }>["error"] };
  }
  console.error("ss_run_draw returned an unknown error:", res.error);
  return { ok: false, error: "failed" };
}
