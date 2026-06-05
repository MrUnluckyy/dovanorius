"use client";
import { useQuery } from "@tanstack/react-query";
import { AddItemModal } from "./AddItemModal";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { WishListItem } from "./WishListItem";
import { LuPlus } from "react-icons/lu";

export type Item = {
  id: string;
  board_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  price: number | null;
  image_url: string | null;
  image_urls: string[];
  is_reservable: boolean;
  status: "wanted" | "reserved" | "purchased";
  reserved_by: string | null;
  reserve_expires_at: string | null;
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
  const t = useTranslations("Boards");

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["items", boardId],
    queryFn: async () => {
      // Reservation visibility is enforced server-side: recipient-side viewers
      // (board owner + collaborators) never receive others' reserved_by/status.
      const { data, error } = await supabase.rpc("get_board_items", {
        p_board_id: boardId,
      });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  if (isLoading) return <BoardsLoadingSkeleton />;

  if (error) return <p className="text-error">😵 failed to load items 😵</p>;

  return (
    <div className="">
      {!isPublic && (
        <div className="mb-4">
          <AddItemModal boardId={boardId}>
            <LuPlus />
            {t("addWish")}
          </AddItemModal>
        </div>
      )}
      {items.length === 0 ? (
        <div className="flex flex-col justify-center items-center">
          <p className="text-center">{t("noItems")}</p>
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
