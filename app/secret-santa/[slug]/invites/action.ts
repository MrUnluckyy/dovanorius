"use server";
import type { SsInvite, SsEvent } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/server";

type Invite = {
  id: string;
  event_id: string;
  to_user: string;
  status: "pending" | "accepted" | "declined" | "revoked";
};
type EventRow = { id: string; name: string; slug: string };

export async function sendInvites(
  slug: string,
  toUserIds: string[]
): Promise<{ ok: true; sent: number }> {
  if (toUserIds.length === 0) return { ok: true, sent: 0 };

  const sb = await createClient();

  const { data: ev, error: evErr } = await sb
    .from("ss_events")
    .select("id, name, owner_id, slug")
    .eq("slug", slug)
    .single<SsEvent>();
  if (evErr || !ev) throw evErr ?? new Error("Event not found");

  const { data: auth } = await sb.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  // Validate admin server-side (RLS also guards)
  // Optionally check ss_members role here if you keep admins there.

  // Insert invites (ignore duplicates thanks to unique(event_id, to_user))
  const rows = toUserIds.map((to) => ({
    event_id: ev.id,
    from_user: me,
    to_user: to,
  }));
  const { data: invites, error: insErr } = await sb
    .from("ss_invites")
    .insert(rows)
    .select("id, to_user")
    .returns<Pick<SsInvite, "id" | "to_user">[]>();
  if (insErr) throw insErr;

  // Fan-out notifications (each recipient inserts their own row; use RPC or do one-by-one with service role; here we create "on behalf" – if RLS blocks, add a small RPC to insert)
  // for (const inv of invites ?? []) {
  //   await sb.from("notifications").insert({
  //     user_id: inv.to_user,
  //     type: "ss_invite",
  //     payload: {
  //       event_id: ev.id,
  //       invite_id: inv.id,
  //       event_name: ev.name,
  //       slug: ev.slug,
  //     },
  //   });
  // }
  for (const inv of invites ?? []) {
    const { error } = await sb.rpc("ss_notify_invite", {
      p_event_id: ev.id,
      p_invite_id: inv.id,
      p_to_user: inv.to_user,
      p_event_name: ev.name,
      p_slug: ev.slug,
    });
    if (error) throw error;
  }

  return { ok: true, sent: invites?.length ?? 0 };
}

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
