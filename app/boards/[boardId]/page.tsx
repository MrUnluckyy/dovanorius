import { Navigation } from "@/components/navigation/Navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WishList } from "./components/WishList";
import { BoardBar } from "./components/BoardBar";
import { getBoard } from "@/app/actions/boards/action";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";

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

  if (!board) {
    redirect("/boards");
  }

  return (
    <main className="pb-20">
      <Navigation user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-10">
          <BoardBar board={board} />
        </div>
        <WishList boardId={board.id} />
      </div>
    </main>
  );
}
