"use server";

import { createClient } from "@/utils/supabase/server";
import { create } from "domain";

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

  const { data: ev, error: e1 } = await supabase
    .from("ss_events")
    .select("id, owner_id, status")
    .eq("slug", slug)
    .single();
  if (e1) throw e1;
  if (ev.status !== "locked" && ev.status !== "open")
    throw new Error("Lock the event before drawing.");

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
    excluded[a].add(b);
    excluded[b].add(a);
  });

  const pairs = drawAssignments(userIds, excluded);

  const { data: draw, error: drawError } = await supabase
    .from("ss_draws")
    .insert({ event_id: ev.id, created_by: ev.owner_id })
    .select()
    .single();

  console.log("draw", draw);
  if (drawError || !draw) {
    console.log("drawError", drawError?.message);
    throw new Error("draw" + drawError?.message);
  }

  const rows = pairs.map(([giver, receiver]) => ({
    draw_id: draw.id,
    event_id: ev.id,
    giver,
    receiver,
  }));
  await supabase.from("ss_assignments").insert(rows);
  await supabase.from("ss_events").update({ status: "drawn" }).eq("id", ev.id);

  return { ok: true, count: rows.length };
}
