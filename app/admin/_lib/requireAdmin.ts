import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

/**
 * Gate for every /admin page. Call it FIRST, before any data is loaded.
 *
 * The check in app/admin/layout.tsx is not enough on its own: Next renders a
 * layout and its page in parallel and streams the page's RSC payload, so a
 * signed-out request got the redirect AND the page's service-role data
 * (partners, contacts, invite tokens, search terms) in the same response.
 * A page that awaits this before touching supabaseAdmin produces nothing for
 * non-admins.
 *
 * cache() makes the layout and the page share one lookup per request.
 */
export const requireAdmin = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/dashboard");

  return user.id;
});
