"use server";

import { createClient } from "@/utils/supabase/server";

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
 * "Repeat this event" lives in the database now (ss_repeat_preview /
 * ss_repeat_event, migration 20261002190000), shared with noriuto-app, which
 * can't call a server action. These two keep their old signatures so the
 * lobby didn't change.
 *
 * The rules are the ones this file used to hold: only a finished event, the
 * year bumped in the name, the same day next year clamped to today..+10y,
 * everyone confirmed but the organiser invited, and a repeat of the same event
 * within two minutes returning the one already made. One fix on the way: draw
 * rules are now copied with their direction, where this copied a and b only.
 */

async function eventIdForSlug(supabase: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data } = await supabase.from("ss_events").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const KNOWN: ReadonlySet<string> = new Set<RepeatError>([
  "not_authenticated",
  "not_found",
  "not_allowed",
  "not_finished",
  "name_required",
  "date_required",
  "date_in_past",
  "date_too_far",
]);
const asError = (e: unknown): RepeatError =>
  typeof e === "string" && KNOWN.has(e) ? (e as RepeatError) : "failed";

/** For the confirm dialog: the new event's name and how many get invited. Writes nothing. */
export async function previewRepeatEvent(slug: string): Promise<RepeatPreview> {
  const supabase = await createClient();
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return { ok: false, error: "not_found" };

  const { data, error } = await supabase.rpc("ss_repeat_preview", { p_event_id: eventId });
  if (error || !data) {
    console.error("previewRepeatEvent failed", error);
    return { ok: false, error: "failed" };
  }
  const res = data as
    | { ok: true; name: string; invitees: number; suggested_date: string | null }
    | { ok: false; error: string };
  if (!res.ok) return { ok: false, error: asError(res.error) };
  return { ok: true, name: res.name, invitees: res.invitees, suggestedDate: res.suggested_date };
}

/** Start next year's edition of a finished event. See ss_repeat_event. */
export async function repeatEvent(
  slug: string,
  input: { name: string; eventDate: string }
): Promise<RepeatResult> {
  const supabase = await createClient();
  const eventId = await eventIdForSlug(supabase, slug);
  if (!eventId) return { ok: false, error: "not_found" };

  const { data, error } = await supabase.rpc("ss_repeat_event", {
    p_event_id: eventId,
    p_name: input.name,
    p_event_date: input.eventDate || null,
  });
  if (error || !data) {
    console.error("repeatEvent failed", error);
    return { ok: false, error: "failed" };
  }
  const res = data as
    | { ok: true; slug: string; invited: number }
    | { ok: false; error: string };
  if (!res.ok) return { ok: false, error: asError(res.error) };
  return { ok: true, slug: res.slug, invited: res.invited };
}
