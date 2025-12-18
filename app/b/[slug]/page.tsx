import { createClient } from "@/utils/supabase/server";
import { BoardBar } from "@/app/boards/[boardId]/components/BoardBar";
import { NavigationV2 } from "@/components/navigation/NavigationV2";

import { Metadata } from "next";
import { notFound } from "next/navigation";
import BreadCrumbsManual from "@/components/navigation/BreadCrumbsManual";
import { WishList } from "@/app/boards/[boardId]/components/WishList";
import Footer from "@/components/footer/Footer";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, name, is_public, created_at, slug, description")
    .eq("slug", params.slug)
    .eq("is_public", true)
    .single();

  if (!board) {
    return {
      title: "Noriuto - Lenta nerasta",
    };
  }

  return {
    title: board.name,
    description: "Mano norų lenta Noriuto platformoje",
    openGraph: {
      title: board.name,
      description: "Pažiūrėk mano Noriuto norų lentą 👇",
      url: `https://noriuto.lt/b/${board.slug}`,
      siteName: "Noriuto",
      images: [
        {
          url: "https://noriuto.lt/assets/dovanorius-3d.png",
          width: 1200,
          height: 630,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: board.name,
      description: "Pažiūrėk mano Noriuto norų lentą 👇",
      images: "https://noriuto.lt/assets/dovanorius-3d.png",
    },
  };
}

export default async function SharedBoardView({
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
    .single();

  if (!board || bErr) {
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
