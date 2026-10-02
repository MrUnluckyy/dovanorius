"use server";

import { createClient } from "@/utils/supabase/server";
import { generateSlug } from "@/utils/helpers/slugify";
import { maxEventDate, parseCalendarDate, todayInVilnius } from "@/lib/events/formatEventDate";

type RepeatError =
  | "not_authenticated"
  | "not_found"
  | "not_allowed"
  | "not_finished"
  | "name_required"
  | "date_required"
  | "date_in_past"
  | "date_too_far"
  | "failed";

export type RepeatPreview =
  | { ok: true; name: string; invitees: number; suggestedDate: string | null }
  | { ok: false; error: RepeatError };

export type RepeatResult =
  | { ok: true; slug: string; invited: number }
  | { ok: false; error: RepeatError };

/**
 * An event is over once it was drawn and its date has passed (Vilnius), or it
 * was archived. Only then is there a "next year" to start. Shared with the
 * lobby, which shows the button on the same rule.
 */
function isFinished(status: string, eventDate: string | null): boolean {
  if (status === "archived") return true;
  return status === "drawn" && !!eventDate && eventDate < todayInVilnius();
}

/** Same day next year (29 Feb -> 28 Feb), kept within today..max. */
function nextYearDate(eventDate: string | null): string | null {
  const d = parseCalendarDate(eventDate);
  if (!d) return null;
  const y = d.year + 1;
  const last = new Date(Date.UTC(y, d.month, 0)).getUTCDate();
  const iso = `${y}-${String(d.month).padStart(2, "0")}-${String(Math.min(d.day, last)).padStart(2, "0")}`;
  const today = todayInVilnius();
  return iso < today ? today : iso > maxEventDate() ? maxEventDate() : iso;
}

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
  if (!isFinished(src.status, src.event_date)) return { error: "not_finished" as const };

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

  return { user, src, name: nextName(src.name, baseYear), suggestedDate: nextYearDate(src.event_date), targets };
}

/** For the confirm dialog: the new event's name and how many get invited. Writes nothing. */
export async function previewRepeatEvent(slug: string): Promise<RepeatPreview> {
  const p = await plan(await createClient(), slug);
  if ("error" in p) return { ok: false, error: p.error! };
  return { ok: true, name: p.name, invitees: p.targets.length, suggestedDate: p.suggestedDate };
}

/**
 * Start next year's edition of a drawn event.
 *
 * Only for a finished event (see isFinished). Name and date come from the
 * organiser's dialog. Same type, budget and notes; previous_event_id points back here so the draw
 * avoids this year's pairs where it can; the draw rules (exclusions) are
 * copied; and everyone who took part, except the organiser, is invited again.
 * The date is left empty: next year's date is the organiser's to pick.
 */
export async function repeatEvent(
  slug: string,
  input: { name: string; eventDate: string }
): Promise<RepeatResult> {
  // The organiser can rename it in the dialog; the date is required.
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "name_required" };
  if (!parseCalendarDate(input.eventDate)) return { ok: false, error: "date_required" };
  if (input.eventDate < todayInVilnius()) return { ok: false, error: "date_in_past" };
  if (input.eventDate > maxEventDate()) return { ok: false, error: "date_too_far" };

  const supabase = await createClient();
  const p = await plan(supabase, slug);
  if ("error" in p) return { ok: false, error: p.error! };
  const { user, src, targets } = p;

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
      event_date: input.eventDate,
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
