"use client";
import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { BoardCard } from "@/app/lentos/components/BoardsCardWithPreview";

type BoardWithPreview = {
  id: string;
  name: string;
  slug: string | null;
  is_owner: boolean;
  item_count: number;
  preview_images: string[];
};

function PublicBoardCard({ board, userId }: { board: BoardWithPreview; userId: string }) {
  return (
    <BoardCard
      href={`/zmones/${userId}/${board.slug}`}
      name={board.name}
      itemCount={board.item_count}
      previewImages={board.preview_images}
    />
  );
}

export function PublicBoardsList({ userId }: { userId: string }) {
  const supabase = createClient();

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["profile-boards", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("users_boards_with_previews", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data ?? []) as BoardWithPreview[];
    },
  });

  if (isLoading) return <BoardsLoadingSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {boards.map((board) => (
        <PublicBoardCard key={board.id} board={board} userId={userId} />
      ))}
    </div>
  );
}
