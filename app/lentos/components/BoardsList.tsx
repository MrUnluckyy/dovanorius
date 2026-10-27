"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { CreateBoard } from "../[boardId]/components/CreateBoard";
import { useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { CategoryMosaicGrid } from "./BoardsCardWithPreview";
import { isAccountUser } from "@/utils/auth/account";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const t = useTranslations("Dashboard");

  const { data: boards = [], isLoading } = useQuery<BoardWithPreview[]>({
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

  // A guest reserving a gift is welcome to look around, but a board they own
  // would vanish with their cookies. Creating one needs an account.
  // Contributing to a board they were INVITED to is a different thing and
  // stays open — that is what the invite was for.
  const canCreate = isAccountUser(user);

  if (boards.length === 0) {
    // Was `{boards.length && …}`, which rendered a bare "0" and nothing else.
    return (
      <EmptyState
        hero="memo"
        title={t("boardsEmptyTitle")}
        hint={t("boardsEmptyHint")}
        action={canCreate ? <CreateBoard user={user} /> : undefined}
      />
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl font-bold">
          {t("boardsTitle")}
          <span className="ml-2 text-base font-semibold text-(--nr-muted)">
            {boards.length}
          </span>
        </h2>
      </div>
      <CategoryMosaicGrid
        items={boards}
        trailing={canCreate ? <CreateBoard user={user} variant="tile" /> : null}
      />
    </section>
  );
}
