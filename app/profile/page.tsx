import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProfileEditForm } from "./components/ProfileEditForm";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { SignOutButton } from "../(auth)/components/SignOutButton";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { ProfileData } from "./components/ProfileData";
import ThemeSelector from "@/components/ThemeSelector";
import { ProfileStats } from "./components/ProfileStats";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="flex flex-col gap-8 mt-10">
          <ProfileData />
          <ThemeSelector />
          <ProfileStats userId={user.id} />
        </div>
      </div>
    </main>
  );
}
