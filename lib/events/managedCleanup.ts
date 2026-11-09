import { supabaseAdmin } from "@/utils/supabase/admin";

// Not a server action on purpose: anything exported from a "use server" file
// can be called from the browser with any argument.

/**
 * A managed person exists only through the events they were added to. Once
 * they are in none, delete them — with their wish list. Called after the
 * organiser removes them; a no-op for everybody else.
 */
export async function cleanUpManagedUser(userId: string): Promise<void> {
  const { data: managed } = await supabaseAdmin
    .from("managed_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!managed) return;

  const { count } = await supabaseAdmin
    .from("ss_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  // Belt and braces: only ever delete an anonymous user.
  if (!authUser?.user?.is_anonymous) return;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) console.error("cleanUpManagedUser: delete failed", userId, error);
}
