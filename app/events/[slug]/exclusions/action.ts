"use server";
import { createClient } from "@/utils/supabase/server";

type ExclusionRow = { b: string };

export async function updateExclusions(
  eventId: string,
  giverId: string,
  blockedIds: string[]
): Promise<{ ok: true }> {
  const sb = await createClient();

  // existing exclusions for this giver in this event
  const { data: existing, error: exErr } = await sb
    .from("ss_exclusions")
    .select("b")
    .eq("event_id", eventId)
    .eq("a", giverId)
    .returns<ExclusionRow[]>();

  if (exErr) throw exErr;

  const existingSet = new Set(existing?.map((r) => r.b) ?? []);
  const blockedSet = new Set(blockedIds);

  // rows to insert
  const toInsert = blockedIds
    .filter((id) => !existingSet.has(id))
    .map((id) => ({
      event_id: eventId,
      a: giverId,
      b: id,
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await sb.from("ss_exclusions").insert(toInsert);
    if (insErr) throw insErr;
  }

  // rows to delete (were previously excluded, now unchecked)
  const toDelete = [...existingSet].filter((id) => !blockedSet.has(id));

  if (toDelete.length > 0) {
    const { error: delErr } = await sb
      .from("ss_exclusions")
      .delete()
      .eq("event_id", eventId)
      .eq("a", giverId)
      .in("b", toDelete);

    if (delErr) throw delErr;
  }

  return { ok: true };
}
