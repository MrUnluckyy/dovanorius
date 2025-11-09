import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { UserBar } from "../boards/components/UserBar";
import { BoardsList } from "../boards/components/BoardsList";
import { ReservedItems } from "./components/ReservedItems";
import { FollowingList } from "./components/FollowingList";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-4 md:mb-10">
          <UserBar />
        </div>

        <BoardsList user={user} />
        <ReservedItems user={user} />
        <FollowingList userId={user.id} />
      </div>
    </main>
  );
}
