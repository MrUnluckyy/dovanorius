"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type DrawRuleResult = { ok: true } | { ok: false; error: string };

/**
 * Draw rules are pairs, not per-person lists.
 *
 * runDraw applies every exclusion in both directions — blocking A from drawing
 * B also stops B drawing A — so a row is really a statement about a couple, and
 * storing or presenting it per-giver was a lie the interface had to keep
 * explaining. Both orientations are treated as the same rule: written in a
 * fixed order so a pair cannot be stored twice, and deleted in either order so
 * rows created by the old per-person screen still come out.
 */
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

type AdminCtx =
  | { error: "not_authenticated" | "not_found" | "not_allowed" | "already_drawn" }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      event: { id: string; status: string };
    };

async function requireAdmin(slug: string): Promise<AdminCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" as const };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, status")
    .eq("slug", slug)
    .single<{ id: string; status: string }>();
  if (!event) return { error: "not_found" as const };

  const { data: isAdmin } = await supabase.rpc("is_event_admin", {
    e: event.id,
  });
  if (!isAdmin) return { error: "not_allowed" as const };

  // After the draw the rules have already been applied; changing them would
  // only mislead, since the assignments are fixed.
  if (event.status === "drawn") return { error: "already_drawn" as const };

  return { supabase, event };
}

export async function addDrawRule(
  slug: string,
  personA: string,
  personB: string
): Promise<DrawRuleResult> {
  if (personA === personB) return { ok: false, error: "same_person" };

  const ctx = await requireAdmin(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const [a, b] = orderPair(personA, personB);
  const { error } = await ctx.supabase
    .from("ss_exclusions")
    .upsert(
      { event_id: ctx.event.id, a, b },
      { onConflict: "event_id,a,b", ignoreDuplicates: true }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

export async function removeDrawRule(
  slug: string,
  personA: string,
  personB: string
): Promise<DrawRuleResult> {
  const ctx = await requireAdmin(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const [a, b] = orderPair(personA, personB);
  // Either orientation: the old per-person screen wrote whichever way round
  // the organiser happened to set it.
  const { error } = await ctx.supabase
    .from("ss_exclusions")
    .delete()
    .eq("event_id", ctx.event.id)
    .or(`and(a.eq.${a},b.eq.${b}),and(a.eq.${b},b.eq.${a})`);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}
