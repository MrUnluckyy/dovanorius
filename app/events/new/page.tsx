import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SsCreateEvent from "../_components/SsCreateEvent";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <SsCreateEvent />
    </main>
  );
}
