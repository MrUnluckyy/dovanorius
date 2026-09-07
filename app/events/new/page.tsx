import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { isAccountUser, loginRedirect } from "@/utils/auth/account";
import SsCreateEvent from "../_components/SsCreateEvent";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAccountUser(user)) redirect(loginRedirect("/events/new"));
  return (
    <main className="min-h-screen bg-(--nr-cream) pb-20">
      <NavigationV2 user={user} />
      <SsCreateEvent />
    </main>
  );
}
