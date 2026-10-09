"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export type RemoveResult = { ok: true; removed: number } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Forbidden");

  return user.id;
}

/**
 * Delete every logged search for the given phrases — testers typing a person's
 * name into the product search, say. search_stats groups by term_norm and
 * returns it as `term`, so that is the key here. All time, not just the visible
 * range: junk in the 90-day view is junk in the 7-day one too.
 */
export async function removeSearchTerms(termNorms: string[]): Promise<RemoveResult> {
  await requireAdminId();

  const terms = Array.from(new Set(termNorms.map((t) => t.trim()).filter(Boolean)));
  if (!terms.length) return { ok: false, error: "Nepasirinkta jokia frazė." };
  if (terms.length > 500) return { ok: false, error: "Per daug frazių vienu kartu." };

  const { count, error } = await supabaseAdmin
    .from("search_log")
    .delete({ count: "exact" })
    .in("term_norm", terms);

  if (error) return { ok: false, error: "Nepavyko pašalinti paieškų." };

  revalidatePath("/admin/searches");
  return { ok: true, removed: count ?? 0 };
}
