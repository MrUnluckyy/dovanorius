import { createClient } from "@/utils/supabase/server";
import { BoardBar } from "@/app/boards/[boardId]/components/BoardBar";
import { WishList } from "@/app/boards/[boardId]/components/WishList";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { notFound } from "next/navigation";
import Footer from "@/components/footer/Footer";
import BreadCrumbsManual from "@/components/navigation/BreadCrumbsManual";

export default async function PublicUserBoardPage({
  params,
}: {
  params: Promise<{ slug: string; userId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { slug, userId } = await params;

  const { data: board, error: bErr } = await supabase
    .from("boards")
    .select("id, name, owner_id, is_public, created_at, slug, description")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!board) {
    notFound();
  }

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <BreadCrumbsManual
            crumbs={[
              {
                label: "userBoards",
                href: `/users/${userId || board?.owner_id}`,
              },
              { label: "board", href: `/users/boards/${board.slug}` },
            ]}
          />

          <div className="py-8 mb-10">
            <BoardBar userId={user?.id} board={board} inPublicView />
          </div>
          <WishList boardId={board.id} user={user} isPublic />
        </div>
      </main>
      <Footer />
    </>
  );
}
