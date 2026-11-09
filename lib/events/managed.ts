import { createClient as createBareClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { isAccountUser } from "@/utils/auth/account";
import { requireAdminEvent } from "@/lib/events/emailInvite";

// Not a server action on purpose: anything exported from a "use server" file
// can be called from the browser with any argument. The website's action
// (app/actions/events/managed.ts) and the app's route
// (app/api/events/managed/route.ts) both call this with their own client.

export type AddManagedResult =
  | { ok: true; userId: string; boardId: string | null }
  | { ok: false; error: string };

/**
 * Add somebody to an event who will never sign in: an older relative, a
 * child, anyone without a phone or e-mail. The organiser looks after them —
 * sees who they drew and keeps their wish list (a shared board).
 *
 * The person is a real anonymous Supabase user, so the draw, exclusions and
 * boards need nothing new. The admin API cannot create a user with neither an
 * e-mail nor a phone, so the user comes from an anonymous sign-in on a
 * throwaway client that never touches the organiser's session. Everything
 * after that is ss_setup_managed_member, which re-checks the organiser and
 * the event itself and is the only way to mark a user as managed.
 *
 * `supabase` is the organiser's own client (cookie on the web, bearer token
 * from the app): it decides who is asking, so the body is never trusted.
 */
export async function addManagedMemberWith(
  supabase: SupabaseClient,
  slug: string,
  name: string
): Promise<AddManagedResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The organiser takes on somebody else's seat, so it takes a real account.
  if (!isAccountUser(user)) return { ok: false, error: "not_authenticated" };

  const ctx = await requireAdminEvent(supabase, slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const displayName = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!displayName) return { ok: false, error: "name_required" };

  const throwaway = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: signedIn, error: signInError } =
    await throwaway.auth.signInAnonymously({
      options: { data: { display_name: displayName } },
    });
  const newId = signedIn?.user?.id;
  if (signInError || !newId) {
    // Anonymous sign-ins are rate-limited per IP; the server shares one.
    const limited = signInError?.status === 429;
    console.error("addManagedMember: anonymous sign-in failed", signInError);
    return { ok: false, error: limited ? "rate_limited" : "create_failed" };
  }
  // Nobody will ever use this session; revoke it rather than leave it valid.
  await throwaway.auth.signOut().catch(() => {});

  const { data, error } = await supabaseAdmin.rpc("ss_setup_managed_member", {
    p_event_id: ctx.event.id,
    p_manager: user.id,
    p_user: newId,
    p_name: displayName,
  });

  const res = data as { ok: boolean; error?: string; board_id?: string | null } | null;
  if (error || !res?.ok) {
    // Leave nothing half-made behind: an unnamed anonymous user with no seat.
    await supabaseAdmin.auth.admin.deleteUser(newId).catch(() => {});
    return { ok: false, error: res?.error ?? error?.message ?? "create_failed" };
  }

  return { ok: true, userId: newId, boardId: res.board_id ?? null };
}
