import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { redirect } from "next/navigation";
import SsHomeScreen from "./_components/SsHomeScreen";

export default async function SecretSantaHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <SsHomeScreen />
    </main>
  );
}
