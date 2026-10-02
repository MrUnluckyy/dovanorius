"use server";

import { createClient } from "@/utils/supabase/server";
import { generateSlug } from "@/utils/helpers/slugify";

export type RepeatResult =
  | { ok: true; slug: string; invited: number }
  | { ok: false; error: "not_authenticated" | "not_found" | "not_allowed" | "not_drawn" | "failed" };

/** "Kalėdos 2026" -> "Kalėdos 2027"; a name without a year gains one. */
function nextName(name: string, fallbackYear: number): string {
  const bumped = name.replace(/\b(19|20)(\d{2})\b/, (y) => String(Number(y) + 1));
  return bumped !== name ? bumped : `${name.trim()} ${fallbackYear + 1}`;
}

/**
 * Start next year's edition of a drawn event.
 *
 * Same type, budget and notes; previous_event_id points back here so the draw
 * avoids this year's pairs; the draw rules (exclusions) are copied; and
 * everyone who took part, except the organiser, is invited again. The date is
 * left empty: next year's date is the organiser's to pick.
 */
export async function repeatEvent(slug: string): Promise<RepeatResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: src } = await supabase
    .from("ss_events")
    .select("id, name, type, budget, currency, notes, status, event_date, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!src) return { ok: false, error: "not_found" };

  const { data: isAdmin } = await supabase.rpc("is_event_admin", { e: src.id });
  if (!isAdmin) return { ok: false, error: "not_allowed" };
  if (src.status !== "drawn") return { ok: false, error: "not_drawn" };

  const baseYear = Number(String(src.event_date ?? src.created_at).slice(0, 4));
  const name = nextName(src.name, baseYear);

  const { data: created, error: createError } = await supabase
    .from("ss_events")
    .insert({
      slug: generateSlug(name),
      owner_id: user.id,
      name,
      type: src.type,
      budget: src.budget,
      currency: src.currency ?? "EUR",
      notes: src.notes,
      status: "open",
      previous_event_id: src.id,
      avoid_previous_match: true,
    })
    .select("id, slug")
    .single();
  if (createError || !created) {
    console.error("repeatEvent: create failed", createError);
    return { ok: false, error: "failed" };
  }

  // Draw rules carry over: the couples are still couples.
  const { data: rules } = await supabase
    .from("ss_exclusions")
    .select("a, b")
    .eq("event_id", src.id);
  if (rules?.length) {
    const { error } = await supabase
      .from("ss_exclusions")
      .insert(rules.map((r) => ({ event_id: created.id, a: r.a, b: r.b })));
    if (error) console.error("repeatEvent: copying rules failed", error);
  }

  // Everyone who took part, minus the organiser (already a member as owner).
  const { data: members } = await supabase
    .from("ss_members")
    .select("user_id")
    .eq("event_id", src.id)
    .eq("is_confirmed", true);
  const candidates = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== user.id);
  // ss_invites.to_user references profiles: one member without a profile row
  // would fail the whole batch.
  const { data: withProfile } = candidates.length
    ? await supabase.from("profiles").select("id").in("id", candidates)
    : { data: [] as { id: string }[] };
  const targets = (withProfile ?? []).map((p) => p.id as string);
  let invited = 0;
  if (targets.length) {
    // The ss_invites trigger sends each of them an in-app invitation.
    const { data: inv, error } = await supabase
      .from("ss_invites")
      .upsert(
        targets.map((to) => ({ event_id: created.id, from_user: user.id, to_user: to, status: "pending" as const })),
        { onConflict: "event_id,to_user" }
      )
      .select("id");
    if (error) console.error("repeatEvent: invites failed", error);
    invited = inv?.length ?? 0;
  }

  return { ok: true, slug: created.slug, invited };
}
