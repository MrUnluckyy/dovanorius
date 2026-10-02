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

export type InviteUsersResult = {
  ok: boolean;
  sent?: number;
  /** Ids that could not be invited; the rest were. */
  failed?: string[];
  error?: string;
};

/**
 * Invite existing Noriuto users by id.
 *
 * Replaces the old `sendInvites`, which trusted the caller: it never checked
 * that you organise the event, so an unauthorised call inserted the invite row
 * and only failed afterwards, leaving the invitation half-created.
 */
export async function inviteUsers(
  slug: string,
  toUserIds: string[]
): Promise<InviteUsersResult> {
  if (toUserIds.length === 0) return { ok: true, sent: 0, failed: [] };

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
  if (targets.length === 0) return { ok: true, sent: 0, failed: [] };

  const row = (to: string) => ({
    event_id: event.id,
    from_user: userId,
    to_user: to,
    status: "pending" as const,
  });

  const { data: invites, error } = await supabase
    .from("ss_invites")
    .upsert(targets.map(row), { onConflict: "event_id,to_user" })
    .select("id, to_user");
  if (error) {
    // The batch is all-or-nothing, and one bad id (a deleted profile, say)
    // would fail everyone. Retry one by one so the sheet can keep exactly the
    // people who failed selected, with the rest invited.
    console.error("inviteUsers batch failed, retrying per person:", error);
    const failed: string[] = [];
    let sent = 0;
    for (const to of targets) {
      const { error: oneError } = await supabase
        .from("ss_invites")
        .upsert(row(to), { onConflict: "event_id,to_user" });
      if (oneError) failed.push(to);
      else sent++;
    }
    return { ok: sent > 0, sent, failed, ...(sent === 0 ? { error: error.message } : {}) };
  }

  // No notification call here: the ss_invites triggers write the 'ss_invite'
  // notification for every invite that becomes pending, for web and app alike
  // (migration 20261001100000).
  return { ok: true, sent: invites?.length ?? 0, failed: [] };
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
    .select("id, name, slug, event_date")
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
        eventDate: event.event_date,
      }),
    });
    if (sendError) throw sendError;
    return { ok: true };
  } catch (err) {
    console.error("Failed to send event joined email:", err);
    return { ok: false };
  }
}
