import { createClient } from "@/utils/supabase/server";
import { isRecipientSide } from "@/utils/boards/viewerSide";
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

  // A collaborator opening a board they co-own is NOT a gift-giver, however
  // they navigated here. Gating on the route alone showed them Reserve on their
  // own wishlist.
  const recipientSide = await isRecipientSide(
    supabase,
    board.id,
    board.owner_id,
    user?.id
  );

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
            <BoardBar userId={user?.id} boardId={board.id} inPublicView />
          </div>
          <WishList boardId={board.id} user={user} isPublic={!recipientSide} />
        </div>
      </main>
      <Footer />
    </>
  );
}
