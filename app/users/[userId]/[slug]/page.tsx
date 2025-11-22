import { createClient } from "@/utils/supabase/server";
import { BoardBar } from "@/app/boards/[boardId]/components/BoardBar";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { WishList } from "@/app/boards/[boardId]/components/WishList";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";
import BreadCrumbsManual from "@/components/navigation/BreadCrumbsManual";

export default async function PublicUserBoardPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { slug, userId } = await params;

  // Fetch board by slug when is_public = true

  const { data: board, error: bErr } = await supabase
    .from("boards")
    .select("id, name, is_public, created_at, slug, description")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!board || bErr) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Board not found</h1>
      </main>
    );
  }

  const filter = user?.id
    ? `reserved_by.is.null,reserved_by.eq.${user.id}`
    : `reserved_by.is.null`;

  // Hide items that are already reserved/purchased for other visitors
  const { data: items } = await supabase
    .from("items")
    .select("id,title,notes,url,status,priority,created_at,reserved_by")
    .eq("board_id", board.id)
    .or(filter)
    .order("created_at", { ascending: false });

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <BreadCrumbsManual
            crumbs={[
              { label: "userBoards", href: `/users/${userId}` },
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
