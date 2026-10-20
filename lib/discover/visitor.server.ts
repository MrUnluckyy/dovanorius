// Server only: reads the session and profile for discover route segments.
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { isAccountUser } from "@/utils/auth/account";
import { resolveVisitor, type ProfileRow, type Visitor } from "./visitorState";

/**
 * The visitor for this request, read once: the layout (sticky bar) and the
 * page both need it, and React's cache() dedupes the two calls.
 */
export const getVisitor = cache(
  async (): Promise<{ visitor: Visitor; userId: string | null }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profile: ProfileRow | null = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, gender, date_of_birth, last_recipient")
        .eq("id", user.id)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    }
    return { visitor: resolveVisitor(profile, isAccountUser(user)), userId: user?.id ?? null };
  }
);
