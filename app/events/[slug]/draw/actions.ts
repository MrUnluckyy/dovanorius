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

export async function runDraw(slug: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: ev, error: e1 } = await supabase
    .from("ss_events")
    .select("id, owner_id, status")
    .eq("slug", slug)
    .single();
  if (e1 || !ev) throw e1 ?? new Error("Event not found");

  // The draw writes assignments for everybody, so it is organisers only. RLS on
  // ss_assignments enforces this too; checking here turns a policy violation
  // into an error the UI can explain.
  const { data: isAdmin } = await supabase.rpc("is_event_admin", { e: ev.id });
  if (!isAdmin) throw new Error("Not allowed");

  if (ev.status !== "locked" && ev.status !== "open")
    throw new Error("Lock the event before drawing.");

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
  if (userIds.length < 2)
    throw new Error("Need at least two confirmed members.");

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

  const pairs = drawAssignments(userIds, excluded);

  const { data: draw, error: drawError } = await supabase
    .from("ss_draws")
    .insert({ event_id: ev.id, created_by: user.id })
    .select("id")
    .single();
  if (drawError || !draw) throw drawError ?? new Error("Could not start draw");

  const rows = pairs.map(([giver, receiver]) => ({
    draw_id: draw.id,
    event_id: ev.id,
    giver,
    receiver,
  }));

  const { error: assignError } = await supabase
    .from("ss_assignments")
    .insert(rows);
  if (assignError) throw assignError;

  const { error: statusError } = await supabase
    .from("ss_events")
    .update({ status: "drawn" })
    .eq("id", ev.id);
  if (statusError) throw statusError;

  return { ok: true, count: rows.length };
}
