import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function SecretSantaDrawPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20 overflow-hidden">🎅</main>
    </>
  );
}
