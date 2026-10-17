import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { isAccountUser } from "@/utils/auth/account";
import { resolveVisitor, type ProfileRow } from "@/lib/discover/visitorState";
import { DiscoverClient } from "./DiscoverClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * The visitor's state (4.1) is resolved here, on the server, so the first
 * paint already shows the right first view. Anonymous guests have a profile
 * row too; a visitor with no session at all is state 1.
 */
export default async function DiscoverPage() {
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

  const visitor = resolveVisitor(profile, isAccountUser(user));

  return <DiscoverClient visitor={visitor} userId={user?.id ?? null} />;
}
