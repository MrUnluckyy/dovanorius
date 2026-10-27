import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { isAccountUser, loginRedirect } from "@/utils/auth/account";
import SsCreateEvent from "../_components/SsCreateEvent";
import { RecreateHint } from "../_components/RecreateHint";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAccountUser(user)) redirect(loginRedirect("/renginiai/naujas"));

  // Drew names in another event lately? Then this may be a redo — offer help.
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("ss_events")
    .select("name, slug")
    .eq("owner_id", user.id)
    .eq("status", "drawn")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-(--nr-cream) pb-20">
      <NavigationV2 user={user} />
      {recent && <RecreateHint name={recent.name} slug={recent.slug} />}
      <SsCreateEvent />
    </main>
  );
}
