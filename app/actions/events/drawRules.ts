"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type DrawRuleResult = { ok: true } | { ok: false; error: string };

/**
 * Draw rules between two people, with a direction.
 *
 * ss_exclusions rows are either two-way (mutual: neither draws the other,
 * stored once with a < b) or one-way (a must not draw b, stored as giver a,
 * receiver b). See migration 20261002120000. Every write goes through
 * setPairRule, which replaces whatever the pair had, so a pair can never hold
 * contradictory rows.
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

/** The rule between two people x and y. */
export type PairRule = "none" | "x_to_y" | "y_to_x" | "both";

/**
 * Set the rule between x and y, replacing any rule the pair had (in either
 * orientation, including rows from older screens).
 *   both    - neither draws the other (partners)
 *   x_to_y  - x must not draw y; y may draw x (e.g. x drew y last year)
 *   y_to_x  - the reverse
 *   none    - no rule
 */
export async function setPairRule(
  slug: string,
  x: string,
  y: string,
  rule: PairRule
): Promise<DrawRuleResult> {
  if (x === y) return { ok: false, error: "same_person" };

  const ctx = await requireAdmin(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error: delError } = await ctx.supabase
    .from("ss_exclusions")
    .delete()
    .eq("event_id", ctx.event.id)
    .or(`and(a.eq.${x},b.eq.${y}),and(a.eq.${y},b.eq.${x})`);
  if (delError) return { ok: false, error: delError.message };

  if (rule !== "none") {
    const row =
      rule === "both"
        ? (() => {
            const [a, b] = orderPair(x, y);
            return { event_id: ctx.event.id, a, b, mutual: true };
          })()
        : rule === "x_to_y"
        ? { event_id: ctx.event.id, a: x, b: y, mutual: false }
        : { event_id: ctx.event.id, a: y, b: x, mutual: false };
    const { error } = await ctx.supabase.from("ss_exclusions").insert(row);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}
