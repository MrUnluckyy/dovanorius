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

export function BoardsList({ user }: { user: User }) {
  const supabase = createClient();
  const t = useTranslations<"Boards">("Boards");
  const format = useFormatter();
  const now = new Date();

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_boards_with_stats")
        .select("*")
        .order("last_item_added_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ids = boards.map((b) => b.id);
  const { membersByBoard } = useBoardMembersMap(ids);

  if (isLoading) return <BoardsLoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <CreateBoard user={user} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {boards.map((board) => (
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
        ))}
      </div>
    </div>
  );
}
