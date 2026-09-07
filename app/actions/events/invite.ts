"use server";

import { Resend } from "resend";
import { createClient } from "@/utils/supabase/server";
import { EventInviteEmail } from "@/emails/EventInviteEmail";
import { EventJoinedEmail } from "@/emails/EventJoinedEmail";
import type { SsEventInvite } from "@/types/secret-santa";

const FROM = process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";
const BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";

export type InviteResult =
  | { ok: true; invite: SsEventInvite; emailSent: boolean }
  | { ok: false; error: string };

/**
 * Resolve a slug to an event the caller is allowed to organise.
 *
 * Every action in this file goes through here. RLS would stop the write
 * anyway, but a policy violation surfaces as an opaque Postgres error; a
 * `not_allowed` we raise ourselves is something the UI can translate.
 */
type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  join_token: string;
  type: string;
  event_date: string | null;
  budget: number | null;
  currency: string | null;
};

type AdminContext =
  | { error: "not_authenticated" | "not_found" | "not_allowed" }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: NonNullable<
        Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]
      >;
      event: AdminEvent;
    };

async function requireAdminEvent(slug: string): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" as const };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, name, slug, owner_id, join_token, type, event_date, budget, currency")
    .eq("slug", slug)
    .single<AdminEvent>();
  if (!event) return { error: "not_found" as const };

  const { data: isAdmin } = await supabase.rpc("is_event_admin", {
    e: event.id,
  });
  if (!isAdmin) return { error: "not_allowed" as const };

  return { supabase, user, event };
}

/** Invite somebody by e-mail address, whether or not they have an account. */
export async function inviteByEmail(
  slug: string,
  email: string
): Promise<InviteResult> {
  const ctx = await requireAdminEvent(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, user, event } = ctx;

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "invalid_email" };
  }

  // Re-inviting the same address reuses its row (and its token), so a person
  // who was sent two invitations does not end up with two links, one of which
  // silently stops working.
  const { data: existing } = await supabase
    .from("ss_event_invites")
    .select("*")
    .eq("event_id", event.id)
    .eq("email", trimmed)
    .is("accepted_at", null)
    .maybeSingle<SsEventInvite>();

  let invite = existing;
  if (!invite) {
    const { data, error } = await supabase
      .from("ss_event_invites")
      .insert({ event_id: event.id, email: trimmed, invited_by: user.id })
      .select("*")
      .single<SsEventInvite>();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "insert_failed" };
    }
    invite = data;
  }

  // Best-effort send: the invitation row exists either way, and the organiser
  // can always fall back to copying the link.
  let emailSent = false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // resend.emails.send() RESOLVES with { data, error } — it does not throw.
    // Reading only the promise would report a refused send as a success and
    // leave the organiser believing the invitation went out.
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: trimmed,
      subject: `Kvietimas: ${event.name} 🎁`,
      react: EventInviteEmail({
        eventName: event.name,
        inviterName: user.user_metadata?.display_name ?? null,
        joinUrl: `${BASE_URL}/events/join/${invite.token}`,
        eventDate: event.event_date,
        budget: event.budget,
        currency: event.currency,
      }),
    });
    if (sendError) throw sendError;
    emailSent = true;
  } catch (err) {
    console.error("Failed to send event invite email:", err);
  }

  return { ok: true, invite, emailSent };
}

/** Withdraw an e-mail invitation. Its link stops working immediately. */
export async function revokeEmailInvite(
  slug: string,
  inviteId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireAdminEvent(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("ss_event_invites")
    .delete()
    .eq("id", inviteId)
    .eq("event_id", ctx.event.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Issue a fresh shared link, invalidating the old one.
 *
 * The organiser's only defence if a link escapes into the wrong group chat —
 * there is no per-recipient control over a link that is meant to be forwarded.
 */
export async function rotateJoinLink(
  slug: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const ctx = await requireAdminEvent(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const token = crypto.randomUUID();
  const { error } = await ctx.supabase
    .from("ss_events")
    .update({ join_token: token })
    .eq("id", ctx.event.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, token };
}

/**
 * Invite existing Noriuto users by id.
 *
 * Replaces the old `sendInvites`, which trusted the caller: it never checked
 * that you organise the event, and `ss_notify_invite` (which does check) ran
 * only afterwards — so an unauthorised call inserted the invite row and *then*
 * threw, leaving the invitation half-created.
 */
export async function inviteUsers(
  slug: string,
  toUserIds: string[]
): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (toUserIds.length === 0) return { ok: true, sent: 0 };

  const ctx = await requireAdminEvent(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, user, event } = ctx;

  // Skip anyone already on the roster so re-inviting is harmless.
  const { data: members } = await supabase
    .from("ss_members")
    .select("user_id")
    .eq("event_id", event.id);
  const already = new Set((members ?? []).map((m) => m.user_id as string));
  const targets = toUserIds.filter((id) => !already.has(id));
  if (targets.length === 0) return { ok: true, sent: 0 };

  const { data: invites, error } = await supabase
    .from("ss_invites")
    .upsert(
      targets.map((to) => ({
        event_id: event.id,
        from_user: user.id,
        to_user: to,
        status: "pending" as const,
      })),
      { onConflict: "event_id,to_user" }
    )
    .select("id, to_user");
  if (error) return { ok: false, error: error.message };

  for (const inv of invites ?? []) {
    const { error: notifyError } = await supabase.rpc("ss_notify_invite", {
      p_event_id: event.id,
      p_invite_id: inv.id,
      p_to_user: inv.to_user,
      p_event_name: event.name,
      p_slug: event.slug,
    });
    // A missed notification is not worth losing the invitation over — it still
    // shows up on the invitee's /events page.
    if (notifyError) console.error("ss_notify_invite failed:", notifyError);
  }

  return { ok: true, sent: invites?.length ?? 0 };
}

/**
 * Confirm a guest's place by e-mail, right after they join through a link.
 *
 * A guest's session is anonymous and lives only in the browser that made it —
 * clearing site data or switching to a phone loses it, and with it the name
 * they drew. This mail is the durable copy of where their event is, which is
 * the reason the join form asks for an address at all.
 */
export async function sendJoinedEmail(
  slug: string,
  email: string,
  displayName?: string | null
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();
  if (!event) return { ok: false };

  // Only somebody who actually joined gets a mail about it — otherwise this
  // action is an open relay that will send anything to any address.
  const { data: membership } = await supabase
    .from("ss_members")
    .select("user_id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: trimmed,
      subject: `Tu dalyvauji: ${event.name} 🎉`,
      react: EventJoinedEmail({
        eventName: event.name,
        eventUrl: `${BASE_URL}/events/${event.slug}`,
        displayName: displayName ?? null,
      }),
    });
    if (sendError) throw sendError;
    return { ok: true };
  } catch (err) {
    console.error("Failed to send event joined email:", err);
    return { ok: false };
  }
}
