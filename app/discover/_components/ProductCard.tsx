"use client";

import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
  LuExternalLink,
  LuPlus,
  LuCheck,
  LuHeart,
  LuX,
  LuSparkles,
  LuUndo2,
} from "react-icons/lu";
import { useBoards } from "@/hooks/useBoards";
import { useAddIdeaToBoard } from "@/hooks/useAddIdeaToBoard";
import type { Signal } from "@/hooks/useProductFeedback";
import { useState } from "react";

export type CardProduct = {
  id: string;
  title: string;
  brand?: string | null;
  price: number | null;
  imageUrl: string | null;
  deepLink: string | null;
  /** Present only for AI picks — the concierge's one-line rationale. */
  reason?: string | null;
};

/** Bump the AWIN image CDN thumbnail for crisper cards. */
function hiRes(url: string): string {
  return url.replace(/([?&])w=\d+/, "$1w=400").replace(/([?&])h=\d+/, "$1h=400");
}

export function ProductCard({
  product,
  signal,
  onReact,
}: {
  product: CardProduct;
  signal?: Signal;
  /** Provided only for signed-in users; absent hides the reaction controls. */
  onReact?: (signal: Signal | null) => void;
}) {
  const t = useTranslations("Inspo");
  const { data: boards = [], isLoading: boardsLoading } = useBoards();
  const addToBoard = useAddIdeaToBoard();
  const [addedBoardId, setAddedBoardId] = useState<string | null>(null);

  const liked = signal === 1;
  const disliked = signal === -1;

  const handleAdd = (boardId: string, boardName: string) => {
    addToBoard.mutate(
      {
        boardId,
        title: product.title,
        url: product.deepLink,
        imageUrl: product.imageUrl,
        price: product.price,
        notes: product.reason ?? null,
      },
      {
        onSuccess: () => {
          setAddedBoardId(boardId);
          toast.success(t("addedToBoard", { board: boardName }));
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : t("addError")),
      }
    );
  };

  // Disliked → collapse to a quiet, recoverable "hidden" tile.
  if (disliked) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-4 text-center">
        <span className="text-sm opacity-50">{t("hidden")}</span>
        <button
          className="btn btn-ghost btn-xs gap-1"
          onClick={() => onReact?.(null)}
        >
          <LuUndo2 className="w-3.5" />
          {t("undo")}
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-base-100 ring-1 ring-base-300/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]">
      {/* Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
        <img
          src={product.imageUrl ? hiRes(product.imageUrl) : "/assets/placeholder.jpg"}
          alt={product.title}
          className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = "/assets/placeholder.jpg";
          }}
        />

        {/* Reactions (signed-in only) */}
        {onReact && (
          <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
            <button
              aria-label={t("like")}
              onClick={() => onReact(liked ? null : 1)}
              className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition ${
                liked
                  ? "bg-primary text-primary-content"
                  : "bg-base-100/80 text-base-content hover:bg-base-100"
              }`}
            >
              <LuHeart className={`w-4 ${liked ? "fill-current" : ""}`} />
            </button>
            <button
              aria-label={t("dislike")}
              onClick={() => onReact(-1)}
              className="grid h-8 w-8 place-items-center rounded-full bg-base-100/80 text-base-content backdrop-blur transition hover:bg-base-100"
            >
              <LuX className="w-4" />
            </button>
          </div>
        )}

        {product.reason && (
          <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-content shadow">
            <LuSparkles className="w-3.5" />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55 line-clamp-1">
            {product.brand}
          </span>
        )}
        <h3 className="text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.title}
        </h3>

        {product.reason && (
          <p className="text-xs italic leading-snug text-primary/80 line-clamp-2">
            {product.reason}
          </p>
        )}

        <div className="mt-auto pt-1">
          <span className="text-base font-bold tracking-tight">
            {product.price != null ? `${product.price} €` : "—"}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="dropdown dropdown-top flex-1">
            <div
              tabIndex={0}
              role="button"
              className={`btn btn-sm w-full normal-case ${
                addedBoardId ? "btn-neutral btn-outline" : "btn-neutral"
              }`}
            >
              {addedBoardId ? (
                <>
                  <LuCheck className="w-3.5" />
                  {t("added")}
                </>
              ) : (
                <>
                  <LuPlus className="w-3.5" />
                  {t("addToBoard")}
                </>
              )}
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu z-10 max-h-64 w-52 flex-nowrap overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300"
            >
              {boardsLoading ? (
                <li className="disabled">
                  <span className="loading loading-spinner loading-xs" />
                </li>
              ) : boards.length === 0 ? (
                <li className="menu-title text-xs">{t("noBoards")}</li>
              ) : (
                boards.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={addToBoard.isPending}
                      onClick={() => {
                        (document.activeElement as HTMLElement)?.blur();
                        handleAdd(b.id, b.name);
                      }}
                    >
                      {b.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {product.deepLink && (
            <a
              href={product.deepLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn btn-sm btn-ghost btn-square"
              aria-label={t("viewInStore")}
            >
              <LuExternalLink className="w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
