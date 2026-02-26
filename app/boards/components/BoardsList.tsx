"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { CreateBoard } from "../[boardId]/components/CreateBoard";
import { useFormatter, useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { useBoardMembersMap } from "@/hooks/useMemberMap";
import { AvatarGroup } from "./AvatarGroup";
import { LuUsers } from "react-icons/lu";
import { CategoryMosaicGrid } from "./BoardsCardWithPreview";

export type BoardWithPreview = {
  id: string;
  name: string;
  description: string | null;
  last_item_added_at: Date;
  slug: string | null;
  is_owner: boolean;
  item_count: number;
  preview_images: string[];
  is_public: boolean;
};

export function BoardsList({ user }: { user: User }) {
  const supabase = createClient();
  const t = useTranslations<"Boards">("Boards");
  const format = useFormatter();

  const { data: boardsWithPreview = [], isLoading } = useQuery<
    BoardWithPreview[]
  >({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_boards_v3")
        .order("last_item_added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardWithPreview[];
    },
  });

  if (isLoading) return <BoardsLoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <CreateBoard user={user} />
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"> */}
      {boardsWithPreview?.length && boardsWithPreview?.length > 0 && (
        <CategoryMosaicGrid items={boardsWithPreview} />
      )}
      {/* {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.id}`}
            className="cursor-pointer"
          >
            <div key={board.id} className="card bg-base-300 card-sm shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-2xl font-heading">
                  {board.name}
                  {membersByBoard[board.id]?.length > 1 && <LuUsers />}
                  {!board.is_public && (
                    <span className="badge badge-info badge-sm ml-2">
                      {t("private")}
                    </span>
                  )}
                </h2>

                <p className="text-semibold">
                  {t("itemsCount", { count: board.item_count })}
                </p>

                <p className="text-semibold">
                  {!board.last_item_added_at
                    ? t("noItemsYet")
                    : `${t("lastUpdated")} ${format.relativeTime(
                        board.last_item_added_at,
                        now
                      )}`}
                </p>
                <div className="justify-between card-actions">
                  <div>
                    {membersByBoard[board.id]?.length > 1 && (
                      <AvatarGroup members={membersByBoard[board.id] || []} />
                    )}
                  </div>
                  <button className="btn btn-accent">{t("ctaView")}</button>
                </div>
              </div>
            </div>
          </Link>
        ))} */}
      {/* </div> */}
    </div>
  );
}
