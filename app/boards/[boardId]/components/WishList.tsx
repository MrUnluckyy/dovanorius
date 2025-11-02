"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddItemModal } from "./AddItemModal";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { WishListItem } from "./WishListItem";

export type Item = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  price: number | null;
  image_url: string | null;
  status: "wanted" | "reserved" | "purchased";
  priority: "low" | "medium" | "high";
  created_at: string;
};

export function WishList({
  boardId,
  isPublic,
  user,
}: {
  boardId: string;
  isPublic?: boolean;
  user?: User | null;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useTranslations("Boards");

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["items", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select(
          "id, title, notes, price, image_url, url, status, priority, created_at"
        )
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    },
  });

  if (isLoading) return <BoardsLoadingSkeleton />;

  if (error) return <p className="text-error">😵 failed to load items 😵</p>;

  return (
    <div className="">
      {!isPublic && (
        <div className="w-full flex justify-end mb-4">
          <AddItemModal boardId={boardId} />
        </div>
      )}
      {items.length === 0 ? (
        <div className="flex flex-col justify-center items-center">
          <p className="text-center text-info-content">{t("noItems")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <WishListItem
            key={item.id}
            boardId={boardId}
            item={item}
            inPublicBoard={isPublic}
            user={user}
          />
        ))}
      </div>
    </div>
  );
}
