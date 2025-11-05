"use client";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export function ProfileStats({ userId }: { userId: string }) {
  const supabase = createClient();
  const t = useTranslations("Profile");

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

  const totalItems = boards.reduce(
    (acc, board) => acc + (board.item_count || 0),
    0
  );

  if (isLoading) return <BoardsLoadingSkeleton />;

  return (
    <div>
      <p className="mb-2 text-2xl font-semibold">{t("stats")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-2xl">🤩</h2>
            <p className="text-2xl font-bold">
              {t("boards", { count: boards.length })}
            </p>
          </div>
        </div>
        <div className="card bg-base-100  shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-2xl">🎁</h2>
            <p className="text-2xl font-bold">
              {t("items", { count: totalItems })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
