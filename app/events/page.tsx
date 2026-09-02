import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { redirect } from "next/navigation";
import SsHomeScreen from "./_components/SsHomeScreen";
import { isAccountUser, loginRedirect } from "@/utils/auth/account";

export default async function SecretSantaHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAccountUser(user)) redirect(loginRedirect("/events"));

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <SsHomeScreen />
    </main>
  );
}
