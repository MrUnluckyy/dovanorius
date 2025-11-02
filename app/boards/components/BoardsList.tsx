"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { CreateBoard } from "../[boardId]/components/CreateBoard";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export function BoardsList({ user }: { user: User }) {
  const supabase = createClient();
  const userId = user.id;
  const t = useTranslations("Boards");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards_with_stats")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
                <h2 className="card-title text-2xl">
                  {board.name}
                  {!board.is_public && (
                    <span className="badge badge-info badge-sm ml-2">
                      {t("private")}
                    </span>
                  )}
                </h2>
                <p className="text-semibold">{`${board.item_count} wishes`}</p>
                <p className="text-semibold">
                  {!board.last_item_added_at
                    ? "No items added yet"
                    : `Last updated ${formatDistanceToNow(
                        new Date(board.last_item_added_at),
                        {
                          addSuffix: true,
                        }
                      )}`}
                </p>
                <div className="justify-end card-actions">
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
