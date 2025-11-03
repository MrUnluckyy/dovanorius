import { createClient } from "@/utils/supabase/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ProfileBar } from "@/app/users/components/ProfileBar";
import { PublicBoardsList } from "../components/PublicBoardsList";
import { NavigationV2 } from "@/components/navigation/NavigationV2";

export default async function UserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-4 md:mb-10">
          <ProfileBar userId={userId} />
        </div>
        <PublicBoardsList userId={userId} />
      </div>
    </main>
  );
}
