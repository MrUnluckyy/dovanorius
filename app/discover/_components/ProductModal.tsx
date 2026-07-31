"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
  LuX,
  LuExternalLink,
  LuPlus,
  LuCheck,
  LuSparkles,
  LuFlag,
} from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useBoards } from "@/hooks/useBoards";
import { useAddIdeaToBoard } from "@/hooks/useAddIdeaToBoard";
import { trackInspo } from "@/utils/trackInspo";
import type { CardProduct } from "./ProductCard";

const ISSUES = ["wrong_category", "wrong_gender", "not_a_gift"] as const;

export function ProductModal({
  product,
  userId,
  onClose,
}: {
  product: CardProduct | null;
  userId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Discover");
  const tInspo = useTranslations("Inspo");
  const { data: boards = [], isLoading: boardsLoading } = useBoards();
  const addToBoard = useAddIdeaToBoard();
  const [addedBoardId, setAddedBoardId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  // Reset transient state whenever a different product opens.
  useEffect(() => {
    setAddedBoardId(null);
    setReportOpen(false);
    setReported(false);
  }, [product?.id]);

  // Close on Escape.
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  if (!product) return null;

  const discount =
    product.discountPct != null &&
    product.discountPct >= 5 &&
    product.discountPct <= 85
      ? Math.round(product.discountPct)
      : null;
  const showRrp =
    discount != null && product.rrp != null && product.rrp > (product.price ?? 0);

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
          trackInspo("save", product.id);
          toast.success(tInspo("addedToBoard", { board: boardName }));
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : tInspo("addError")),
      }
    );
  };

  const submitReport = async (issue: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("inspo_corrections")
      .insert({ product_id: product.id, user_id: userId, issue });
    if (error) {
      toast.error(tInspo("addError"));
      return;
    }
    setReported(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-base-100 shadow-2xl sm:rounded-3xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-base-100/80 backdrop-blur transition hover:bg-base-200"
        >
          <LuX className="w-5" />
        </button>

        {/* Image */}
        <div className="relative aspect-[4/5] w-full shrink-0 bg-white md:max-h-[92vh] md:w-1/2">
          <img
            src={product.imageUrl ?? "/assets/placeholder.jpg"}
            alt={product.title}
            className="h-full w-full object-contain p-6"
            onError={(e) => {
              e.currentTarget.src = "/assets/placeholder.jpg";
            }}
          />
          {discount != null && (
            <span className="absolute left-4 top-4 rounded-full bg-error px-2.5 py-1 text-sm font-bold text-error-content shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

        {/* Details */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div>
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-55">
                {product.brand}
              </p>
            )}
            <h2 className="mt-1 font-heading text-xl font-bold leading-snug tracking-tight">
              {product.title}
            </h2>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                discount != null ? "text-error" : ""
              }`}
            >
              {product.price != null ? `${product.price} €` : "—"}
            </span>
            {showRrp && (
              <span className="text-sm line-through opacity-40">
                {product.rrp} €
              </span>
            )}
          </div>

          {product.reason && (
            <div className="flex gap-2 rounded-2xl bg-primary/10 p-3 text-sm">
              <LuSparkles className="mt-0.5 w-4 shrink-0 text-primary" />
              <p className="italic leading-snug">{product.reason}</p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {product.deepLink && (
              <a
                href={product.deepLink}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => trackInspo("click_out", product.id)}
                className="btn btn-neutral w-full gap-2 rounded-full"
              >
                <LuExternalLink className="w-4" />
                {tInspo("viewInStore")}
              </a>
            )}

            {/* Save to a board */}
            <div className="dropdown dropdown-top w-full">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-outline btn-neutral w-full cursor-pointer gap-2 rounded-full"
              >
                {addedBoardId ? (
                  <>
                    <LuCheck className="w-4" />
                    {tInspo("added")}
                  </>
                ) : (
                  <>
                    <LuPlus className="w-4" />
                    {tInspo("addToBoard")}
                  </>
                )}
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-10 max-h-64 w-full flex-nowrap overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300"
              >
                {boardsLoading ? (
                  <li className="disabled">
                    <span className="loading loading-spinner loading-xs" />
                  </li>
                ) : boards.length === 0 ? (
                  <li className="menu-title text-xs">{tInspo("noBoards")}</li>
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
          </div>

          {/* Item correction */}
          {userId && (
            <div className="border-t border-base-200 pt-3">
              {reported ? (
                <p className="flex items-center gap-2 text-sm opacity-60">
                  <LuCheck className="w-4 text-success" />
                  {t("report.thanks")}
                </p>
              ) : reportOpen ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs opacity-60">
                    {t("report.prompt")}
                  </span>
                  {ISSUES.map((issue) => (
                    <button
                      key={issue}
                      onClick={() => submitReport(issue)}
                      className="cursor-pointer rounded-full bg-base-200 px-3 py-1 text-xs transition hover:bg-base-300"
                    >
                      {t(`report.${issue}`)}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setReportOpen(true)}
                  className="flex cursor-pointer items-center gap-1.5 text-xs opacity-50 transition hover:opacity-90"
                >
                  <LuFlag className="w-3.5" />
                  {t("report.cta")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
