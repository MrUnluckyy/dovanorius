"use server";

import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

/**
 * Marks a report dealt with. Re-checks is_admin here rather than trusting the
 * layout: a server action is its own entry point and can be called directly.
 */
export async function markHandled(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { ok: false };

  const { error } = await supabaseAdmin
    .from("client_reports")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark report handled:", error);
    return { ok: false };
  }
  return { ok: true };
}
