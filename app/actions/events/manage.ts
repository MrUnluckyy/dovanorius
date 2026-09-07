"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type ManageResult = { ok: true } | { ok: false; error: string };

type EventPatch = {
  name?: string;
  event_date?: string | null;
  budget?: number | null;
  notes?: string | null;
  cover_image_url?: string | null;
};

/**
 * Edit an event.
 *
 * `slug` and `type` are deliberately not editable. The slug is baked into every
 * link already shared, and the type decides whether there is a draw at all —
 * changing either after people have joined breaks something for somebody else.
 */
export async function updateEvent(
  slug: string,
  patch: EventPatch
): Promise<ManageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) {
    return { ok: false, error: "name_required" };
  }

  // RLS (events_owner_write) is what actually enforces ownership; an empty
  // update result means the row was invisible to this user.
  const { data, error } = await supabase
    .from("ss_events")
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(patch.event_date !== undefined
        ? { event_date: patch.event_date || null }
        : {}),
      ...(patch.budget !== undefined ? { budget: patch.budget } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
      ...(patch.cover_image_url !== undefined
        ? { cover_image_url: patch.cover_image_url }
        : {}),
    })
    .eq("slug", slug)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_allowed" };

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

/**
 * Delete an event and everything hanging off it.
 *
 * Members, invitations, exclusions, draws and assignments all cascade at the
 * FK level, so this is a single statement — and it is irreversible, which is
 * why the caller confirms first.
 */
export async function deleteEvent(slug: string): Promise<ManageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("ss_events")
    .delete()
    .eq("slug", slug)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_allowed" };

  revalidatePath("/events");
  return { ok: true };
}

/** Remove somebody from the roster. Organisers only; the owner cannot go. */
export async function removeMember(
  slug: string,
  userId: string
): Promise<ManageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, owner_id, status")
    .eq("slug", slug)
    .single();
  if (!event) return { ok: false, error: "not_found" };
  if (event.owner_id === userId) return { ok: false, error: "cannot_remove_owner" };

  // After the draw every remaining assignment points at a ring that includes
  // this person; dropping them would leave their giver with nobody to buy for.
  if (event.status === "drawn") return { ok: false, error: "already_drawn" };

  const { error } = await supabase
    .from("ss_members")
    .delete()
    .eq("event_id", event.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  // Clear any invitation too, or the roster shows them again as "invited".
  await supabase
    .from("ss_invites")
    .delete()
    .eq("event_id", event.id)
    .eq("to_user", userId);

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

/** Leave an event you joined. The organiser deletes instead. */
export async function leaveEvent(slug: string): Promise<ManageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, owner_id, status")
    .eq("slug", slug)
    .single();
  if (!event) return { ok: false, error: "not_found" };
  if (event.owner_id === user.id) return { ok: false, error: "owner_cannot_leave" };
  if (event.status === "drawn") return { ok: false, error: "already_drawn" };

  const { error } = await supabase
    .from("ss_members")
    .delete()
    .eq("event_id", event.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("ss_invites")
    .update({ status: "declined" })
    .eq("event_id", event.id)
    .eq("to_user", user.id);

  revalidatePath("/events");
  return { ok: true };
}

/** Reopen registration on an event that was locked too early. */
export async function setEventStatus(
  slug: string,
  status: "open" | "locked"
): Promise<ManageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("ss_events")
    .update({ status })
    .eq("slug", slug)
    .in("status", ["open", "locked"]) // never un-draw an event
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_allowed" };

  revalidatePath(`/events/${slug}`);
  return { ok: true };
}
