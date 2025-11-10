import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { BoardsList } from "../boards/components/BoardsList";
import { ReservedItems } from "./components/ReservedItems";
import { FollowingList } from "./components/FollowingList";
import { DashboardUser } from "./components/DashboardUser";

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
        <div className="py-8 mb-4 md:mb-10">
          <DashboardUser />
        </div>

        <BoardsList user={user} />
        <ReservedItems user={user} />
        <FollowingList userId={user.id} />
      </div>
    </main>
  );
}
