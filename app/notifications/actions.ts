// app/notifications/actions.ts
"use server";
import { createClient } from "@/utils/supabase/server";

export async function markNotificationsRead(
  ids: string[]
): Promise<{ ok: true }> {
  const sb = await createClient();
  if (!ids.length) return { ok: true };
  const { error } = await sb
    .from("notifications")
    .update({ is_read: true })
    .in("id", ids);
  if (error) throw error;
  return { ok: true };
}
