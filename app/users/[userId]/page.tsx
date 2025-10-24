import { Navigation } from "@/components/navigation/Navigation";
import { createClient } from "@/utils/supabase/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ProfileBar } from "@/app/users/components/ProfileBar";
import { PublicBoardsList } from "../components/PublicBoardsList";

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
      <Navigation user={user} />

      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-4 md:mb-10">
          <ProfileBar />
        </div>
        <PublicBoardsList userId={userId} />
      </div>
    </main>
  );
}
