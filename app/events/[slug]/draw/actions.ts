"use server";

import { createClient } from "@/utils/supabase/server";

type Pair = [string, string];
function drawAssignments(
  userIds: string[],
  excluded: Record<string, Set<string>>
): Pair[] {
  const n = userIds.length;
  if (n < 2) throw new Error("Need at least 2 members");
  // Fisher–Yates attempts + backtracking fallback
  for (let a = 0; a < 2000; a++) {
    const receivers = [...userIds];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }
    let ok = true;
    for (let i = 0; i < n; i++) {
      const g = userIds[i],
        r = receivers[i];
      if (g === r || excluded[g]?.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return userIds.map((g, i) => [g, receivers[i]]);
  }
  // backtracking
  const res: Pair[] = [],
    used = new Set<string>();
  const bt = (i: number): boolean => {
    if (i === n) return true;
    const g = userIds[i];
    for (const r of userIds) {
      if (r === g || used.has(r) || excluded[g]?.has(r)) continue;
      used.add(r);
      res.push([g, r]);
      if (bt(i + 1)) return true;
      used.delete(r);
      res.pop();
    }
    return false;
  };
  if (!bt(0)) throw new Error("No valid assignment with current exclusions.");
  return res;
}

export type DrawResult =
  | { ok: true; count: number }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "not_allowed"
        | "wrong_status"
        | "too_few"
        | "impossible_exclusions"
        | "failed";
    };

/**
 * Returns its failures instead of throwing them.
 *
 * Next.js redacts errors thrown from a Server Action in production — the
 * client receives a generic message and a digest, never the text. The caller
 * was matching on `err.message.includes("exclusion")` to tell "your
 * restrictions make a draw impossible" from "something broke", which worked in
 * dev and silently degraded to the generic failure for every real user.
 */
export async function runDraw(slug: string): Promise<DrawResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: ev, error: e1 } = await supabase
    .from("ss_events")
    .select("id, owner_id, status")
    .eq("slug", slug)
    .single();
  if (e1 || !ev) return { ok: false, error: "not_found" };

  // The draw writes assignments for everybody, so it is organisers only. RLS on
  // ss_assignments enforces this too; checking here turns a policy violation
  // into an error the UI can explain.
  const { data: isAdmin } = await supabase.rpc("is_event_admin", { e: ev.id });
  if (!isAdmin) return { ok: false, error: "not_allowed" };

  if (ev.status !== "locked" && ev.status !== "open")
    return { ok: false, error: "wrong_status" };

  // Anyone still sitting on an unanswered invitation is not in the draw, and
  // their invitation is now meaningless — retire it so the roster stops
  // showing them as pending forever.
  await supabase
    .from("ss_invites")
    .update({ status: "revoked" })
    .eq("event_id", ev.id)
    .eq("status", "pending");

  const { data: members } = await supabase
    .from("ss_members")
    .select("user_id")
    .eq("event_id", ev.id)
    .eq("is_confirmed", true);

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length < 2) return { ok: false, error: "too_few" };

  const { data: ex } = await supabase
    .from("ss_exclusions")
    .select("a,b")
    .eq("event_id", ev.id);

  const excluded: Record<string, Set<string>> = {};
  for (const u of userIds) excluded[u] = new Set([u]);
  ex?.forEach(({ a, b }) => {
    // An exclusion can name somebody who has since left the event, and
    // excluded[a] would then be undefined.
    excluded[a]?.add(b);
    excluded[b]?.add(a);
  });

  let pairs: Pair[];
  try {
    pairs = drawAssignments(userIds, excluded);
  } catch {
    // The only way drawAssignments gives up: exclusions that cannot be
    // satisfied. That is the organiser's own setting, and the one failure
    // here they can actually act on.
    return { ok: false, error: "impossible_exclusions" };
  }

  const { data: draw, error: drawError } = await supabase
    .from("ss_draws")
    .insert({ event_id: ev.id, created_by: user.id })
    .select("id")
    .single();
  if (drawError || !draw) {
    console.error("Could not create draw:", drawError);
    return { ok: false, error: "failed" };
  }

  const rows = pairs.map(([giver, receiver]) => ({
    draw_id: draw.id,
    event_id: ev.id,
    giver,
    receiver,
  }));

  const { error: assignError } = await supabase
    .from("ss_assignments")
    .insert(rows);
  if (assignError) {
    console.error("Could not write assignments:", assignError);
    return { ok: false, error: "failed" };
  }

  const { error: statusError } = await supabase
    .from("ss_events")
    .update({ status: "drawn" })
    .eq("id", ev.id);
  if (statusError) {
    console.error("Draw written but status not updated:", statusError);
    return { ok: false, error: "failed" };
  }

  return { ok: true, count: rows.length };
}
