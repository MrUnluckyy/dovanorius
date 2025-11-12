"use server";
import type { SsInvite, SsEvent } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/server";

export async function sendInvites(
  slug: string,
  toUserIds: string[]
): Promise<{ ok: true; sent: number }> {
  const sb = await createClient();

  const { data: ev, error: evErr } = await sb
    .from("ss_events")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .single<SsEvent>();
  if (evErr || !ev) throw evErr ?? new Error("Event not found");

  const { data: auth } = await sb.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  // inserts
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

  // send notifications via SECURITY DEFINER
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

export async function acceptInvite(inviteId: string): Promise<{ ok: true }> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  // Get invite (ensures it's mine via RLS on update)
  const { data: inv, error: gErr } = await sb
    .from("ss_invites")
    .select("id, event_id, to_user, status")
    .eq("id", inviteId)
    .single<{
      id: string;
      event_id: string;
      to_user: string;
      status: "pending" | "accepted" | "declined" | "revoked";
    }>();
  if (gErr || !inv) throw gErr ?? new Error("Invite not found");
  if (inv.to_user !== me) throw new Error("Not your invite");
  if (inv.status !== "pending") return { ok: true };

  // Upsert member as confirmed
  await sb.from("ss_members").upsert(
    {
      event_id: inv.event_id,
      user_id: me,
      is_confirmed: true,
      role: "member" as const,
    },
    { onConflict: "event_id,user_id" }
  );

  // Mark invite accepted
  const { error: uErr } = await sb
    .from("ss_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);
  if (uErr) throw uErr;

  return { ok: true };
}

export async function declineInvite(inviteId: string): Promise<{ ok: true }> {
  const sb = await createClient();
  const { error } = await sb
    .from("ss_invites")
    .update({ status: "declined" })
    .eq("id", inviteId);
  if (error) throw error;
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
