import { createClient } from "@/utils/supabase/server";
import { BoardBar } from "@/app/boards/[boardId]/components/BoardBar";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { WishList } from "@/app/boards/[boardId]/components/WishList";
import Footer from "@/components/footer/Footer";

type Board = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  slug: string | null;
  is_public: boolean;
  share_token: string | null;
};

async function getBoardByToken(token: string): Promise<Board | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_board_by_share_token", {
    p_token: token,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as Board;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const board = await getBoardByToken(token);

  if (!board) {
    return { title: "Noriuto - Lenta nerasta" };
  }

  return {
    title: board.name,
    description: "Norų lenta Noriuto platformoje",
    openGraph: {
      title: board.name,
      description: "Pažiūrėk Noriuto norų lentą 👇",
      url: `https://noriuto.lt/b/s/${token}`,
      siteName: "Noriuto",
      images: [
        {
          url: "https://noriuto.lt/assets/meta/noriuto-meta.jpg",
          width: 1200,
          height: 630,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: board.name,
      description: "Pažiūrėk Noriuto norų lentą 👇",
      images: "https://noriuto.lt/assets/meta/noriuto-meta.jpg",
    },
  };
}

export default async function MagicLinkBoardView({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const board = await getBoardByToken(token);

  if (!board) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <div className="py-8 mb-10">
            <BoardBar userId={user?.id} boardId={board.id} inPublicView />
          </div>
          <WishList boardId={board.id} user={user} isPublic />
        </div>
      </main>
      <Footer />
    </>
  );
}
