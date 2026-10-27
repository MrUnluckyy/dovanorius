import { createClient } from "@/utils/supabase/server";
import { isRecipientSide } from "@/utils/boards/viewerSide";
import { BoardBar } from "@/app/lentos/[boardId]/components/BoardBar";
import { WishList } from "@/app/lentos/[boardId]/components/WishList";
import { BoardViewBeacon } from "@/components/boards/BoardViewBeacon";
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
  const { slug, userId } = await params;

  // Independent lookups; awaiting them one after the other was a full extra
  // round trip before anything could render.
  const [
    {
      data: { user },
    },
    { data: board },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("boards")
      .select("id, name, owner_id, is_public, created_at, slug, description")
      .eq("slug", slug)
      .eq("is_public", true)
      .maybeSingle(),
  ]);

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
                href: `/zmones/${userId || board?.owner_id}`,
              },
              { label: "board", href: `/b/${board.slug}` },
            ]}
          />

          <div className="py-8 mb-10">
            <BoardBar userId={user?.id} boardId={board.id} inPublicView />
          </div>
          <BoardViewBeacon
            boardId={board.id}
            ownerId={board.owner_id}
            userId={user?.id}
            isGuest={user?.is_anonymous === true}
          />
          <WishList
            ownerId={board.owner_id}
            boardId={board.id}
            user={user}
            isPublic={!recipientSide}
            boardName={board.name}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
