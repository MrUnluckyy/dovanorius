import { Navigation } from "@/components/navigation/Navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProfileEditForm } from "./components/ProfileEditForm";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main>
      <Navigation user={user} />

      <div className="max-w-[1440px] mx-auto min-h-screen">
        <div className="flex justify-center mt-10">
          <ProfileEditForm />
        </div>
      </div>
    </main>
  );
}
