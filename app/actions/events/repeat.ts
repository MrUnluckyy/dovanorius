"use server";

import { createClient } from "@/utils/supabase/server";
import { generateSlug } from "@/utils/helpers/slugify";

type RepeatError = "not_authenticated" | "not_found" | "not_allowed" | "not_drawn" | "failed";

export type RepeatPreview =
  | { ok: true; name: string; invitees: number }
  | { ok: false; error: RepeatError };

export type RepeatResult =
  | { ok: true; slug: string; invited: number }
  | { ok: false; error: RepeatError };

/** "Kalėdos 2026" -> "Kalėdos 2027"; a name without a year gains one. */
function nextName(name: string, fallbackYear: number): string {
  const bumped = name.replace(/\b(19|20)(\d{2})\b/, (y) => String(Number(y) + 1));
  return bumped !== name ? bumped : `${name.trim()} ${fallbackYear + 1}`;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * What repeating would do, without doing it: the new name and who would be
 * invited. Shared by the preview (for the confirm dialog) and the action, so
 * the dialog can't promise a different number than gets sent.
 */
async function plan(supabase: Supabase, slug: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" as const };

  const { data: src } = await supabase
    .from("ss_events")
    .select("id, name, type, budget, currency, notes, status, event_date, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!src) return { error: "not_found" as const };

  const { data: isAdmin } = await supabase.rpc("is_event_admin", { e: src.id });
  if (!isAdmin) return { error: "not_allowed" as const };
  if (src.status !== "drawn") return { error: "not_drawn" as const };

  const baseYear = Number(String(src.event_date ?? src.created_at).slice(0, 4));

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

  return { user, src, name: nextName(src.name, baseYear), targets };
}

/** For the confirm dialog: the new event's name and how many get invited. Writes nothing. */
export async function previewRepeatEvent(slug: string): Promise<RepeatPreview> {
  const p = await plan(await createClient(), slug);
  if ("error" in p) return { ok: false, error: p.error! };
  return { ok: true, name: p.name, invitees: p.targets.length };
}

/**
 * Start next year's edition of a drawn event.
 *
 * Same type, budget and notes; previous_event_id points back here so the draw
 * avoids this year's pairs where it can; the draw rules (exclusions) are
 * copied; and everyone who took part, except the organiser, is invited again.
 * The date is left empty: next year's date is the organiser's to pick.
 */
export async function repeatEvent(slug: string): Promise<RepeatResult> {
  const supabase = await createClient();
  const p = await plan(supabase, slug);
  if ("error" in p) return { ok: false, error: p.error! };
  const { user, src, name, targets } = p;

  // A second request for the same repeat (double tap, retry after a slow
  // network) returns the event the first one made instead of a twin.
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("ss_events")
    .select("slug")
    .eq("previous_event_id", src.id)
    .eq("owner_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return { ok: true, slug: recent.slug as string, invited: 0 };

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
