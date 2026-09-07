import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { redirect } from "next/navigation";
import { loginRedirect } from "@/utils/auth/account";
import SsHomeScreen from "./_components/SsHomeScreen";

export default async function SecretSantaHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guests belong here: a link-joined participant has an anonymous
  // session and still needs to find the event they joined.
  if (!user) redirect(loginRedirect("/events"));

  return (
    <main className="min-h-screen bg-(--nr-cream) pb-20">
      <NavigationV2 user={user} />
      <SsHomeScreen userId={user.id} />
    </main>
  );
}
