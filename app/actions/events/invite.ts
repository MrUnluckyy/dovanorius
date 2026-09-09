"use server";

import { Resend } from "resend";
import { createClient } from "@/utils/supabase/server";
import { EventJoinedEmail } from "@/emails/EventJoinedEmail";
import {
  INVITE_BASE_URL,
  MAIL_FROM,
  inviteByEmailWith,
  requireAdminEvent as requireAdminEventWith,
  type InviteResult,
} from "@/lib/events/emailInvite";

/**
 * Every action here organises an event, so every one starts by proving the
 * caller may. The check itself lives in `lib/events/emailInvite` because the
 * mobile app's API route needs the same one with a different client.
 */
async function requireAdminEvent(slug: string) {
  return requireAdminEventWith(await createClient(), slug);
}

/**
 * Invite somebody by e-mail address, whether or not they have an account.
 *
 * Thin wrapper: the work is shared with `POST /api/events/invite`, which is how
 * the mobile app sends the very same invitation.
 */
export async function inviteByEmail(
  slug: string,
  email: string
): Promise<InviteResult> {
  return inviteByEmailWith(await createClient(), slug, email);
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
  const { supabase, userId, event } = ctx;

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
        from_user: userId,
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
      from: MAIL_FROM,
      to: trimmed,
      subject: `Tu dalyvauji: ${event.name} 🎉`,
      react: EventJoinedEmail({
        eventName: event.name,
        eventUrl: `${INVITE_BASE_URL}/events/${event.slug}`,
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
