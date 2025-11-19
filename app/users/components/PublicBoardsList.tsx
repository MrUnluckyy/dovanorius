"use client";
import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export function PublicBoardsList({ userId }: { userId: string }) {
  const supabase = createClient();
  const t = useTranslations("Boards");
  const format = useFormatter();

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_boards_for_user")
        .select("*")
        .eq("access_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const now = new Date();

  if (isLoading) return <BoardsLoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/users/${userId}/${board.slug}`}
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
