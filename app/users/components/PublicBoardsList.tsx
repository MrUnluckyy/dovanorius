"use client";
import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

type BoardWithPreview = {
  id: string;
  name: string;
  slug: string | null;
  is_owner: boolean;
  item_count: number;
  preview_images: string[];
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MosaicCell({ className, image }: { className: string; image?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full bg-base-200" />
      )}
    </div>
  );
}

function PublicBoardCard({ board, userId }: { board: BoardWithPreview; userId: string }) {
  const t = useTranslations("Boards");
  const format = useFormatter();
  const now = new Date();
  const imgs = board.preview_images?.slice(0, 3) ?? [];

  return (
    <Link
      href={`/users/${userId}/${board.slug}`}
      className={cn(
        "group block rounded-3xl bg-neutral-50 p-3 shadow-sm ring-1 ring-black/5",
        "transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      )}
      aria-label={board.name}
    >
      <div className="overflow-hidden rounded-2xl bg-base-200">
        <div className="grid h-[150px] grid-cols-3 grid-rows-2 gap-2 md:h-[170px] lg:h-[190px]">
          <MosaicCell className="col-span-2 row-span-2" image={imgs[0]} />
          <MosaicCell className="col-span-1 row-span-1" image={imgs[1]} />
          <MosaicCell className="col-span-1 row-span-1" image={imgs[2]} />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 px-1">
        <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
          {board.name}
        </h3>
        <p className="text-sm text-base-content/60">
          {t("itemsCount", { count: board.item_count })}
        </p>
      </div>

      <div className="mt-1 px-1 text-sm text-neutral-500 opacity-0 transition group-hover:opacity-100">
        {t("ctaView")} &rarr;
      </div>
    </Link>
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
