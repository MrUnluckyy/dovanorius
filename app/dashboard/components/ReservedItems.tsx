"use client";
import { Item } from "@/app/boards/[boardId]/components/WishList";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import React from "react";
import { ReservedItemsList } from "./ReservedItemsList";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export function ReservedItems({ user }: { user: User }) {
  const supabase = createClient();
  const t = useTranslations("Boards");

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reservedItems", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select(
          "id, board_id, title, notes, price, image_url, url, status, reserved_by, reserved_at, priority, created_at, created_by(display_name, avatar_url)"
        )
        .eq("reserved_by", user.id)
        .order("reserved_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    },
  });

  console.log("Reserved items:", items);

  return (
    <div className="my-8">
      <h2 className="font-heading text-2xl font-bold">Išsaugoti pirkiniai</h2>
      {isLoading ? (
        <BoardsLoadingSkeleton />
      ) : (
        <ReservedItemsList items={items} />
      )}
    </div>
  );
}
