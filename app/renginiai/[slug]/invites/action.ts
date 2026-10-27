"use server";
import { createClient } from "@/utils/supabase/server";

/**
 * Answering an invitation. Sending one lives in app/actions/events/invite.ts —
 * the old `sendInvites` here trusted its caller and inserted the invite row
 * before the permission check ran, so an unauthorised call left a half-created
 * invitation behind.
 */
type Invite = {
  id: string;
  event_id: string;
  to_user: string;
  status: "pending" | "accepted" | "declined" | "revoked";
};
type EventRow = { id: string; name: string; slug: string };

export async function acceptInvite(
  inviteId: string
): Promise<{ ok: true; slug: string }> {
  const sb = await createClient();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Not authenticated");

  const { data: inv, error: iErr } = await sb
    .from("ss_invites")
    .select("id,event_id,to_user,status")
    .eq("id", inviteId)
    .single<Invite>();
  if (iErr || !inv) throw iErr ?? new Error("Invite not found");
  if (inv.to_user !== me) throw new Error("Not your invite");

  const { data: ev, error: eErr } = await sb
    .from("ss_events")
    .select("id,name,slug")
    .eq("id", inv.event_id)
    .single<EventRow>();
  if (eErr || !ev) throw eErr ?? new Error("Event not found");

  // Upsert membership (confirmed)
  const { error: mErr } = await sb.from("ss_members").upsert(
    {
      event_id: ev.id,
      user_id: me,
      is_confirmed: true,
      role: "member" as const,
    },
    { onConflict: "event_id,user_id" }
  );
  if (mErr) throw mErr;

  // Mark invite accepted
  const { error: uErr } = await sb
    .from("ss_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);
  if (uErr) throw uErr;

  // Mark invite notifications read for me
  await sb
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", me)
    .eq("type", "ss_invite")
    .contains("payload", { invite_id: inviteId });

  // Insert "joined" notification for me with CTA
  const { error: nErr } = await sb.from("notifications").insert({
    user_id: me,
    type: "ss_joined",
    payload: { event_id: ev.id, event_name: ev.name, slug: ev.slug },
  });
  if (nErr) throw nErr;

  return { ok: true, slug: ev.slug };
}

export async function declineInvite(inviteId: string): Promise<{ ok: true }> {
  const sb = await createClient();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) throw new Error("Not authenticated");

  const { error: uErr } = await sb
    .from("ss_invites")
    .update({ status: "declined" })
    .eq("id", inviteId);
  if (uErr) throw uErr;

  // Mark the invite notification read so it disappears
  await sb
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", me)
    .eq("type", "ss_invite")
    .contains("payload", { invite_id: inviteId });

  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<{ ok: true }> {
  const sb = await createClient();
  const { error } = await sb
    .from("ss_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
  return { ok: true };
}
