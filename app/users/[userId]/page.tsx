import { createClient } from "@/utils/supabase/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ProfileBar } from "@/app/users/components/ProfileBar";
import { PublicBoardsList } from "../components/PublicBoardsList";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";
import BreadCrumbsManual from "@/components/navigation/BreadCrumbsManual";

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

  const crumbs = [{ label: "userBoards", href: `/users/${userId}` }];

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <BreadCrumbsManual crumbs={crumbs} />
          <div className="py-8 mb-4 md:mb-10">
            <ProfileBar authUserId={user?.id} userId={userId} />
          </div>
          <PublicBoardsList userId={userId} />
        </div>
      </main>
      <Footer />
    </>
  );
}
