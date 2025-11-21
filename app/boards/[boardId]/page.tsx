import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WishList } from "./components/WishList";
import { BoardBar } from "./components/BoardBar";
import { getBoard, getBoardMembers } from "@/app/actions/boards/action";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";
import BreadCrumbsManual from "@/components/navigation/BreadCrumbsManual";

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

  const members = await getBoardMembers(boardId);

  if (
    !board ||
    (board.owner_id !== user.id && !members.find((m) => m.user_id === user.id))
  ) {
    redirect("/boards");
  }

  const crumbs = [{ label: "myBoard", href: `/boards/${board.slug}` }];

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <BreadCrumbsManual crumbs={crumbs} />
          <div className="py-8 mb-10">
            <BoardBar userId={user.id} board={board} />
          </div>
          <WishList boardId={board.id} />
        </div>
      </main>
      <Footer />
    </>
  );
}
