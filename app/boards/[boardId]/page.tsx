import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WishList } from "./components/WishList";
import { BoardBar } from "./components/BoardBar";
import { getBoard } from "@/app/actions/boards/action";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { NavigationV2 } from "@/components/navigation/NavigationV2";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  const board = await getBoard(boardId);

  // MAKE MORE ADVANCED ACCESS CHECKS LATER
  // if (!board || board.owner_id !== user.id) {
  //   redirect("/boards");
  // }

  return (
    <main className="pb-20">
      <NavigationV2 user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-10">
          <BoardBar userId={user.id} board={board} />
        </div>
        <WishList boardId={board.id} />
      </div>
    </main>
  );
}
